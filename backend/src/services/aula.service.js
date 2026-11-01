const { prisma } = require("../lib/prisma");
const { hojeEmLisboa } = require("../lib/tempo");
const { bloquear } = require("../lib/bloqueios");
const { AppError } = require("../utils/AppError");
const { notificar } = require("../lib/notificacoes");

const INCLUDE_RELACOES = {
  turmaUc: {
    select: {
      id: true,
      turmaId: true,
      formadorId: true,
      uc: { select: { id: true, abreviatura: true, nome: true, cargaHoraria: true } },
    },
  },
  disponibilidade: { select: { id: true, formadorId: true, data: true, horaInicio: true } },
};

// Quem deu cada aula: o dono do bloco de disponibilidade em que ela está marcada. Ao substituir o
// formador de uma UC só as aulas futuras passam para blocos do novo formador; as já dadas ficam nos
// blocos do anterior, por isso horários, relatórios e calendários usam este formador e não o atual da UC.
const FORMADOR_DA_AULA = { select: { formador: { select: { id: true, nome: true } } } };

function comFormadorDaAula(aulas) {
  return aulas.map((a) =>
    a.disponibilidade?.formador ? { ...a, turmaUc: { ...a.turmaUc, formador: a.disponibilidade.formador } } : a
  );
}

async function listarPorTurmaUc(turmaUcId) {
  return prisma.aula.findMany({
    where: { turmaUcId },
    include: INCLUDE_RELACOES,
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
}

// Horário de uma turma: todas as aulas de todas as UCs, com UC e formador,
// opcionalmente limitadas a um intervalo de datas (semana visível).
async function listarPorTurma(turmaId, de, ate) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  const filtroData = {};
  if (de) filtroData.gte = new Date(de);
  if (ate) filtroData.lte = new Date(ate);

  const aulas = await prisma.aula.findMany({
    where: { turmaUc: { turmaId }, ...(de || ate ? { data: filtroData } : {}) },
    include: {
      turmaUc: {
        select: {
          id: true,
          uc: { select: { abreviatura: true, nome: true } },
          formador: { select: { id: true, nome: true } },
        },
      },
      disponibilidade: FORMADOR_DA_AULA,
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
  return comFormadorDaAula(aulas);
}

// Horário geral (coordenação): aulas de todas as turmas num intervalo, com
// filtros opcionais por turma e por formador.
async function listarGeral({ de, ate, turmaId, formadorId }) {
  const filtroData = {};
  if (de) filtroData.gte = new Date(de);
  if (ate) filtroData.lte = new Date(ate);

  const aulas = await prisma.aula.findMany({
    where: {
      ...(de || ate ? { data: filtroData } : {}),
      turmaUc: { ativo: true, ...(turmaId ? { turmaId } : {}) },
      ...(formadorId ? { disponibilidade: { formadorId } } : {}),
    },
    include: {
      turmaUc: {
        select: {
          id: true,
          uc: { select: { abreviatura: true, nome: true } },
          formador: { select: { id: true, nome: true } },
          turma: { select: { id: true, codigo: true } },
        },
      },
      disponibilidade: FORMADOR_DA_AULA,
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
  return comFormadorDaAula(aulas);
}

// Horário pessoal: o formador vê as aulas que dá; o formando as da sua turma.
async function listarMinhas(user, de, ate) {
  const filtroData = {};
  if (de) filtroData.gte = new Date(de);
  if (ate) filtroData.lte = new Date(ate);

  let filtroAula;
  if (user.role === "FORMADOR") {
    filtroAula = { disponibilidade: { formadorId: user.id }, turmaUc: { ativo: true } };
  } else {
    const formando = await prisma.user.findUnique({ where: { id: user.id }, select: { turmaId: true } });
    if (!formando || !formando.turmaId) return [];
    filtroAula = { turmaUc: { turmaId: formando.turmaId } };
  }

  const aulas = await prisma.aula.findMany({
    where: { ...filtroAula, ...(de || ate ? { data: filtroData } : {}) },
    include: {
      turmaUc: {
        select: {
          id: true,
          uc: { select: { abreviatura: true, nome: true } },
          formador: { select: { id: true, nome: true } },
          turma: { select: { codigo: true } },
        },
      },
      disponibilidade: FORMADOR_DA_AULA,
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
  return comFormadorDaAula(aulas);
}

async function obterOuFalhar(id) {
  const aula = await prisma.aula.findUnique({ where: { id }, include: INCLUDE_RELACOES });
  if (!aula) {
    throw new AppError(404, "AULA_NOT_FOUND", "Aula não encontrada.");
  }
  return aula;
}

async function criar({ turmaUcId, disponibilidadeId, modalidade }) {
  const turmaUc = await prisma.turmaUc.findUnique({
    where: { id: turmaUcId },
    include: { uc: true },
  });
  if (!turmaUc) {
    throw new AppError(404, "TURMA_UC_NOT_FOUND", "Esta UC não está associada a nenhuma turma.");
  }
  if (!turmaUc.ativo) {
    throw new AppError(422, "TURMA_UC_INATIVA", "Esta associação de UC à turma está inativa — não é possível agendar novas aulas.");
  }

  const bloco = await prisma.disponibilidade.findUnique({
    where: { id: disponibilidadeId },
    include: { aula: true },
  });
  if (!bloco) {
    throw new AppError(404, "BLOCO_NOT_FOUND", "Bloco de disponibilidade não encontrado.");
  }
  // Um bloco "apagado" (soft delete) continua a existir na BD e pode manter
  // estado LIVRE — sem esta verificação dava para agendar numa disponibilidade
  // que o formador já removeu, só por se conhecer o id.
  if (!bloco.ativo) {
    throw new AppError(422, "BLOCO_INATIVO", "Este bloco de disponibilidade foi removido — pede ao formador para o redefinir.");
  }
  if (bloco.formadorId !== turmaUc.formadorId) {
    throw new AppError(422, "FORMADOR_DIFERENTE", "Este bloco de disponibilidade não pertence ao formador desta UC nesta turma.");
  }
  if (bloco.estado !== "LIVRE") {
    throw new AppError(409, "BLOCO_BLOQUEADO", "Este bloco está marcado como bloqueado pelo formador.");
  }
  if (bloco.aula) {
    throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada.");
  }

  // Verificação da carga horária e criação dentro da mesma transação — reduz
  // a janela em que dois pedidos simultâneos (dois blocos livres diferentes
  // da mesma UC) poderiam ambos passar a validação e ultrapassar o limite.
  return prisma.$transaction(async (tx) => {
    // Pedidos em simultâneo (outro agendamento, o formador a bloquear o bloco...) esperam aqui
    // e as verificações abaixo já veem o que eles gravaram.
    await bloquear(tx, "turmas", turmaUc.turmaId);
    await bloquear(tx, "turma_ucs", turmaUcId);
    await bloquear(tx, "disponibilidades", disponibilidadeId);
    const blocoAtual = await tx.disponibilidade.findUnique({ where: { id: disponibilidadeId }, include: { aula: true } });
    if (!blocoAtual.ativo) {
      throw new AppError(422, "BLOCO_INATIVO", "Este bloco de disponibilidade foi removido — pede ao formador para o redefinir.");
    }
    if (blocoAtual.estado !== "LIVRE") {
      throw new AppError(409, "BLOCO_BLOQUEADO", "Este bloco está marcado como bloqueado pelo formador.");
    }
    if (blocoAtual.aula) {
      throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada.");
    }

    // Os blocos são por formador, por isso dois formadores com o mesmo horário
    // livre passariam as verificações acima — mas a turma não pode ter duas
    // aulas à mesma hora (os formandos não estão em dois sítios).
    const aulaDaTurma = await tx.aula.findFirst({
      where: { data: bloco.data, horaInicio: bloco.horaInicio, turmaUc: { turmaId: turmaUc.turmaId } },
    });
    if (aulaDaTurma) {
      throw new AppError(409, "TURMA_OCUPADA", "Esta turma já tem uma aula agendada a essa data e hora.");
    }

    const agregada = await tx.aula.aggregate({ where: { turmaUcId }, _sum: { duracaoHoras: true } });
    const horasJaDadas = agregada._sum.duracaoHoras || 0;
    if (horasJaDadas + 1 > turmaUc.uc.cargaHoraria) {
      throw new AppError(
        409,
        "CARGA_HORARIA_EXCEDIDA",
        `Esta UC tem ${turmaUc.uc.cargaHoraria}h de carga horária e já tem ${horasJaDadas}h agendadas — não é possível agendar mais horas.`
      );
    }

    return tx.aula.create({
      data: {
        turmaUcId,
        disponibilidadeId,
        data: bloco.data,
        horaInicio: bloco.horaInicio,
        duracaoHoras: 1,
        modalidade,
      },
      include: INCLUDE_RELACOES,
    });
  });
}

// Muda uma aula futura para outro bloco livre do mesmo formador (sem ter de
// cancelar e voltar a criar). A carga horária não muda: é a mesma hora de aula.
// Agenda várias aulas de uma vez (uma por bloco), pela ordem cronológica dos
// blocos. Cada aula passa pelas mesmas regras de `criar`; as que falham (bloco
// ocupado, turma ocupada, carga horária esgotada...) não impedem as outras e
// são devolvidas com o motivo — assim agendar 20 aulas não é tudo-ou-nada.
async function criarLote({ turmaUcId, disponibilidadeIds, modalidade }) {
  const blocos = await prisma.disponibilidade.findMany({
    where: { id: { in: disponibilidadeIds } },
    select: { id: true },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
  const ordenados = blocos.map((b) => b.id);
  const desconhecidos = disponibilidadeIds.filter((id) => !ordenados.includes(id));

  const criadas = [];
  const falhadas = desconhecidos.map((id) => ({ disponibilidadeId: id, motivo: "Bloco de disponibilidade não encontrado." }));
  for (const disponibilidadeId of ordenados) {
    try {
      criadas.push(await criar({ turmaUcId, disponibilidadeId, modalidade }));
    } catch (erro) {
      if (!(erro instanceof AppError)) throw erro;
      falhadas.push({ disponibilidadeId, codigo: erro.code, motivo: erro.message });
    }
  }
  return { criadas: criadas.length, falhadas };
}

// Repete as aulas de uma semana da turma nas N semanas seguintes (mesmo dia da
// semana, mesma hora, mesma UC e formador) — o horário tipo de uma formação.
// Cada repetição passa por `criar` (bloco do formador livre, turma não ocupada,
// carga horária...), por isso o que não der é devolvido com o motivo, sem
// impedir as restantes. Semana = a que contém `semanaDe` (segunda a domingo).
async function repetirSemana({ turmaId, semanaDe, numSemanas }) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }

  const base = new Date(`${semanaDe}T00:00:00.000Z`);
  const diaSemana = (base.getUTCDay() + 6) % 7; // segunda = 0
  const inicio = new Date(base);
  inicio.setUTCDate(inicio.getUTCDate() - diaSemana);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 6);

  const aulasOrigem = await prisma.aula.findMany({
    where: { data: { gte: inicio, lte: fim }, turmaUc: { turmaId, ativo: true } },
    include: { turmaUc: { select: { id: true, formadorId: true } } },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
  if (aulasOrigem.length === 0) {
    throw new AppError(422, "SEMANA_SEM_AULAS", "Esta turma não tem aulas nessa semana para repetir.");
  }

  const criadas = [];
  const falhadas = [];
  for (let k = 1; k <= numSemanas; k++) {
    for (const aula of aulasOrigem) {
      const destino = new Date(aula.data);
      destino.setUTCDate(destino.getUTCDate() + 7 * k);
      const rotulo = `${destino.toISOString().slice(0, 10)} ${String(aula.horaInicio).padStart(2, "0")}:00`;

      const bloco = await prisma.disponibilidade.findFirst({
        where: { formadorId: aula.turmaUc.formadorId, data: destino, horaInicio: aula.horaInicio, ativo: true },
        select: { id: true },
      });
      if (!bloco) {
        falhadas.push({ quando: rotulo, codigo: "SEM_BLOCO", motivo: "O formador não marcou disponibilidade nessa hora.", formadorId: aula.turmaUc.formadorId });
        continue;
      }
      try {
        criadas.push(await criar({ turmaUcId: aula.turmaUc.id, disponibilidadeId: bloco.id, modalidade: aula.modalidade }));
      } catch (erro) {
        if (!(erro instanceof AppError)) throw erro;
        falhadas.push({ quando: rotulo, codigo: erro.code, motivo: erro.message });
      }
    }
  }
  return { aulasNaSemana: aulasOrigem.length, criadas: criadas.length, falhadas };
}

function descreverAula(aula) {
  const [ano, mes, dia] = aula.data.toISOString().slice(0, 10).split("-");
  return `${dia}/${mes}/${ano} às ${String(aula.horaInicio).padStart(2, "0")}:00`;
}

// Avisa o formador e os formandos da turma quando uma aula futura é movida ou
// cancelada. Só diz o que mudou (UC e data/hora) — nada sensível. Nunca faz
// falhar a operação (ver notificacoes.js). Criar aulas não avisa ninguém: são
// muitas de cada vez e seria ruído.
async function avisarMudancaDeAula(aula, { tipo, assunto, linhas }) {
  const formandos = await prisma.user.findMany({
    where: { role: "FORMANDO", ativo: true, turmaId: aula.turmaUc.turmaId },
    select: { id: true },
  });
  await notificar([aula.disponibilidade?.formadorId ?? aula.turmaUc.formadorId, ...formandos.map((f) => f.id)], { tipo, assunto, linhas });
}

async function reagendar(id, { disponibilidadeId, modalidade }) {
  const aula = await obterOuFalhar(id);
  const hoje = hojeEmLisboa();
  if (aula.data < hoje) {
    throw new AppError(422, "AULA_PASSADA", "Só é possível reagendar aulas que ainda não aconteceram.");
  }

  const turmaUc = await prisma.turmaUc.findUnique({ where: { id: aula.turmaUcId } });
  if (!turmaUc.ativo) {
    throw new AppError(422, "TURMA_UC_INATIVA", "Esta associação de UC à turma está inativa — não é possível reagendar aulas.");
  }
  const bloco = await prisma.disponibilidade.findUnique({ where: { id: disponibilidadeId }, include: { aula: true } });
  if (!bloco) {
    throw new AppError(404, "BLOCO_NOT_FOUND", "Bloco de disponibilidade não encontrado.");
  }
  if (!bloco.ativo) {
    throw new AppError(422, "BLOCO_INATIVO", "Este bloco de disponibilidade foi removido — pede ao formador para o redefinir.");
  }
  if (bloco.formadorId !== turmaUc.formadorId) {
    throw new AppError(422, "FORMADOR_DIFERENTE", "Este bloco de disponibilidade não pertence ao formador desta UC nesta turma.");
  }
  if (bloco.estado !== "LIVRE") {
    throw new AppError(409, "BLOCO_BLOQUEADO", "Este bloco está marcado como bloqueado pelo formador.");
  }
  if (bloco.aula && bloco.aula.id !== id) {
    throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada.");
  }
  const inicioDeHoje = hojeEmLisboa();
  if (bloco.data < inicioDeHoje) {
    throw new AppError(422, "DATA_PASSADA", "Não é possível reagendar uma aula para uma data que já passou.");
  }

  const atualizada = await prisma.$transaction(async (tx) => {
    await bloquear(tx, "turmas", turmaUc.turmaId);
    await bloquear(tx, "disponibilidades", disponibilidadeId);
    const blocoAtual = await tx.disponibilidade.findUnique({ where: { id: disponibilidadeId }, include: { aula: true } });
    if (!blocoAtual.ativo || blocoAtual.estado !== "LIVRE") {
      throw new AppError(409, "BLOCO_BLOQUEADO", "Este bloco já não está livre.");
    }
    if (blocoAtual.aula && blocoAtual.aula.id !== id) {
      throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada.");
    }
    const aulaDaTurma = await tx.aula.findFirst({
      where: { id: { not: id }, data: bloco.data, horaInicio: bloco.horaInicio, turmaUc: { turmaId: turmaUc.turmaId } },
    });
    if (aulaDaTurma) {
      throw new AppError(409, "TURMA_OCUPADA", "Esta turma já tem uma aula agendada a essa data e hora.");
    }
    return tx.aula.update({
      where: { id },
      data: { disponibilidadeId, data: bloco.data, horaInicio: bloco.horaInicio, ...(modalidade ? { modalidade } : {}) },
      include: INCLUDE_RELACOES,
    });
  });

  await avisarMudancaDeAula(atualizada, {
    tipo: "AULA_REAGENDADA",
    assunto: `Aula de ${aula.turmaUc.uc.abreviatura} reagendada`,
    linhas: [`A aula de ${aula.turmaUc.uc.abreviatura} — ${aula.turmaUc.uc.nome} marcada para ${descreverAula(aula)} foi reagendada para ${descreverAula(atualizada)}.`, "Consulta o teu horário na plataforma."],
  });
  return atualizada;
}

// Relatório de horas por formador (coordenação): por cada formador ativo, as
// horas de aula no período — "dadas" (já aconteceram) e "por dar" (futuras) —
// com o detalhe por UC/turma, mais as horas de disponibilidade que marcou.
async function relatorioHorasPorFormador(de, ate) {
  const filtroData = {};
  if (de) filtroData.gte = new Date(de);
  if (ate) filtroData.lte = new Date(ate);
  const intervalo = de || ate ? { data: filtroData } : {};

  const [formadores, aulas, blocos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "FORMADOR", ativo: true },
      select: { id: true, nome: true, sigla: true },
      orderBy: { nome: "asc" },
    }),
    prisma.aula.findMany({
      where: { turmaUc: { ativo: true }, ...intervalo },
      select: {
        data: true,
        duracaoHoras: true,
        disponibilidade: { select: { formadorId: true } },
        turmaUc: { select: { uc: { select: { abreviatura: true, nome: true } }, turma: { select: { codigo: true } } } },
      },
    }),
    prisma.disponibilidade.findMany({
      where: { ativo: true, ...intervalo },
      select: { formadorId: true, estado: true, aula: { select: { id: true } } },
    }),
  ]);

  const hoje = hojeEmLisboa();

  return formadores.map((formador) => {
    const doFormador = aulas.filter((a) => a.disponibilidade.formadorId === formador.id); // quem deu a aula, não o formador atual da UC
    const porUc = new Map();
    let dadas = 0;
    let porDar = 0;
    doFormador.forEach((a) => {
      const passada = a.data < hoje;
      if (passada) dadas += a.duracaoHoras;
      else porDar += a.duracaoHoras;
      const chave = `${a.turmaUc.turma.codigo}|${a.turmaUc.uc.abreviatura}`;
      const linha = porUc.get(chave) || { turma: a.turmaUc.turma.codigo, uc: a.turmaUc.uc.abreviatura, ucNome: a.turmaUc.uc.nome, dadas: 0, porDar: 0 };
      linha[passada ? "dadas" : "porDar"] += a.duracaoHoras;
      porUc.set(chave, linha);
    });

    const dele = blocos.filter((b) => b.formadorId === formador.id);
    return {
      formador,
      horasDadas: dadas,
      horasPorDar: porDar,
      horasTotal: dadas + porDar,
      // "livre" = marcado livre e ainda sem aula (um bloco com aula já não está livre).
      blocosLivres: dele.filter((b) => b.estado === "LIVRE" && !b.aula).length,
      blocosBloqueados: dele.filter((b) => b.estado === "BLOQUEADO").length,
      detalhe: [...porUc.values()].sort((a, b) => a.turma.localeCompare(b.turma) || a.uc.localeCompare(b.uc)),
    };
  });
}

async function cancelar(id) {
  const aula = await obterOuFalhar(id);
  await prisma.aula.delete({ where: { id } });

  const hoje = hojeEmLisboa();
  if (aula.data >= hoje) {
    await avisarMudancaDeAula(aula, {
      tipo: "AULA_CANCELADA",
      assunto: `Aula de ${aula.turmaUc.uc.abreviatura} cancelada`,
      linhas: [`A aula de ${aula.turmaUc.uc.abreviatura} — ${aula.turmaUc.uc.nome} marcada para ${descreverAula(aula)} foi cancelada.`, "Consulta o teu horário na plataforma."],
    });
  }
}

module.exports = { repetirSemana, listarGeral, criarLote, relatorioHorasPorFormador, reagendar, listarMinhas, listarPorTurma, listarPorTurmaUc, criar, cancelar, obterOuFalhar };
