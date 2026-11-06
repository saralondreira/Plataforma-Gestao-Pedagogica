const { prisma } = require("../lib/prisma");
const { hojeEmLisboa } = require("../lib/tempo");
const { bloquear } = require("../lib/bloqueios");
const { AppError } = require("../utils/AppError");
const { enviarNotificacaoUcAtribuida } = require("../lib/mailer");

// Associação de uma UC do catálogo a uma turma concreta, com o formador que
// a vai lecionar nessa turma (a mesma UC pode ter formadores diferentes em
// turmas diferentes). A carga horária vem sempre do catálogo (uc.cargaHoraria).

const INCLUDE_RELACOES = {
  uc: { select: { id: true, abreviatura: true, nome: true, cargaHoraria: true } },
  formador: { select: { id: true, nome: true, sigla: true } },
  turma: { select: { id: true, codigo: true, designacao: true } },
};

async function validarTurmaUcFormador(turmaId, ucId, formadorId) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  if (!turma.ativo) {
    throw new AppError(422, "TURMA_INATIVA", "Esta turma está inativa.");
  }
  const uc = await prisma.uc.findUnique({ where: { id: ucId } });
  if (!uc) {
    throw new AppError(404, "UC_NOT_FOUND", "UC não encontrada no catálogo.");
  }
  if (!uc.ativo) {
    throw new AppError(422, "UC_INATIVA", "Esta UC está inativa no catálogo.");
  }
  const formador = await prisma.user.findUnique({ where: { id: formadorId } });
  if (!formador || formador.role !== "FORMADOR") {
    throw new AppError(422, "FORMADOR_INVALIDO", "O formador indicado não existe ou não tem o papel de Formador.");
  }
  if (!formador.ativo) {
    throw new AppError(422, "FORMADOR_INATIVO", "O formador indicado está inativo.");
  }
}

async function horasDadasDe(turmaUcId) {
  const agregada = await prisma.aula.aggregate({
    where: { turmaUcId },
    _sum: { duracaoHoras: true },
  });
  return agregada._sum.duracaoHoras || 0;
}

async function comHoras(turmaUc) {
  const horasDadas = await horasDadasDe(turmaUc.id);
  return {
    ...turmaUc,
    horasDadas,
    horasEmFalta: Math.max(turmaUc.uc.cargaHoraria - horasDadas, 0),
  };
}

// Notifica o formador por email quando é atribuído (ou reatribuído) a
// lecionar esta UC nesta turma. Falha silenciosamente (só regista no log) —
// um problema no envio de email nunca deve impedir a associação em si.
// O nome/email do formador vêm de uma consulta dedicada em vez de alargar
// INCLUDE_RELACOES, porque esse "select" alimenta respostas públicas (ex.:
// GET /turma-ucs/turma/:turmaId, usado no dashboard do Formando) e não deve
// expor o email do formador a quem consulta essa lista.
async function notificarFormadorAtribuido(turmaUc) {
  try {
    const formador = await prisma.user.findUnique({
      where: { id: turmaUc.formadorId },
      select: { nome: true, email: true },
    });
    if (!formador) return;
    await enviarNotificacaoUcAtribuida({
      nome: formador.nome,
      email: formador.email,
      turmaCodigo: turmaUc.turma.codigo,
      turmaDesignacao: turmaUc.turma.designacao,
      ucAbreviatura: turmaUc.uc.abreviatura,
      ucNome: turmaUc.uc.nome,
      cargaHoraria: turmaUc.uc.cargaHoraria,
    });
  } catch (erro) {
    console.error("[turmaUc] Falha ao enviar notificação de atribuição por email:", erro.message);
  }
}

async function listarPorTurma(turmaId, { incluirInativos = false } = {}) {
  const associacoes = await prisma.turmaUc.findMany({
    where: { turmaId, ...(incluirInativos ? {} : { ativo: true }) },
    include: INCLUDE_RELACOES,
    orderBy: { uc: { abreviatura: "asc" } },
  });
  return Promise.all(associacoes.map(comHoras));
}

// As UCs que o formador autenticado leciona agora (para escolher a UC nas
// páginas de notas, assiduidade e trabalhos).
async function listarDoFormador(formadorId) {
  return prisma.turmaUc.findMany({
    where: { formadorId, ativo: true, turma: { ativo: true } },
    include: INCLUDE_RELACOES,
    orderBy: [{ turma: { codigo: "asc" } }, { uc: { abreviatura: "asc" } }],
  });
}

async function obterOuFalhar(id) {
  const turmaUc = await prisma.turmaUc.findUnique({ where: { id }, include: INCLUDE_RELACOES });
  if (!turmaUc) {
    throw new AppError(404, "TURMA_UC_NOT_FOUND", "Associação Turma/UC não encontrada.");
  }
  return turmaUc;
}

// Trocar o formador não move as aulas já marcadas — elas continuam ligadas
// aos blocos de disponibilidade do formador antigo (Aula.disponibilidadeId),
// por isso a agenda ficaria inconsistente. Decisão (2026-10-20, ver
// PLANEAMENTO.md): bloquear a troca em vez de mover/cancelar aulas
// automaticamente — a coordenação cancela as aulas futuras primeiro.
async function garantirSemAulasFuturas(turmaUcId) {
  const aulasFuturas = await prisma.aula.count({
    where: { turmaUcId, data: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
  });
  if (aulasFuturas > 0) {
    throw new AppError(
      409,
      "TURMA_UC_COM_AULAS_FUTURAS",
      `Esta UC tem ${aulasFuturas} aula(s) futura(s) marcada(s) com o formador atual — cancela-as antes de trocar de formador.`
    );
  }
}

// Substitui o formador de uma UC numa turma JÁ com aulas futuras (ex.: baixa
// do formador): as aulas futuras passam para blocos livres do novo formador
// na MESMA data e hora, e as passadas ficam como estão (histórico). Se o novo
// formador não tiver bloco livre para alguma aula futura, nada muda e devolve
// 409 SEM_BLOCOS_LIVRES com a lista — a não ser que `cancelarSemBloco` seja
// verdadeiro, caso em que essas aulas são canceladas (a coordenação volta a
// agendá-las depois). Tudo numa transação.
async function substituirFormador(id, novoFormadorId, { cancelarSemBloco = false } = {}) {
  const atual = await obterOuFalhar(id);
  if (!atual.ativo) {
    throw new AppError(422, "TURMA_UC_INATIVA", "Esta associação de UC à turma está inativa.");
  }
  if (novoFormadorId === atual.formadorId) {
    throw new AppError(422, "FORMADOR_IGUAL", "O novo formador é o mesmo que já está associado.");
  }
  const formador = await prisma.user.findUnique({ where: { id: novoFormadorId } });
  if (!formador || formador.role !== "FORMADOR") {
    throw new AppError(422, "FORMADOR_INVALIDO", "O formador indicado não existe ou não tem o papel de Formador.");
  }
  if (!formador.ativo) {
    throw new AppError(422, "FORMADOR_INATIVO", "O formador indicado está inativo.");
  }

  const hoje = hojeEmLisboa();
  const aulasFuturas = await prisma.aula.findMany({
    where: { turmaUcId: id, data: { gte: hoje } },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  const blocosNovos = await prisma.disponibilidade.findMany({
    where: { formadorId: novoFormadorId, ativo: true, estado: "LIVRE", aula: null, data: { gte: hoje } },
  });
  const porChave = new Map(blocosNovos.map((b) => [`${b.data.toISOString().slice(0, 10)}|${b.horaInicio}`, b]));

  const pares = aulasFuturas.map((aula) => ({ aula, bloco: porChave.get(`${aula.data.toISOString().slice(0, 10)}|${aula.horaInicio}`) }));
  const semBloco = pares.filter((p) => !p.bloco);

  if (semBloco.length > 0 && !cancelarSemBloco) {
    const exemplos = semBloco
      .slice(0, 5)
      .map((p) => {
        const [a, m, d] = p.aula.data.toISOString().slice(0, 10).split("-");
        return `${d}/${m}/${a} ${String(p.aula.horaInicio).padStart(2, "0")}:00`;
      })
      .join(", ");
    throw new AppError(
      409,
      "SEM_BLOCOS_LIVRES",
      `O novo formador não tem bloco livre para ${semBloco.length} das ${aulasFuturas.length} aula(s) futura(s) (${exemplos}${semBloco.length > 5 ? "…" : ""}). Pede-lhe que marque essas horas como livres, ou cancela essas aulas.`
    );
  }

  // Aulas que seriam canceladas mas já têm presenças, sumário ou justificações: não se apagam (perdia-se o
  // histórico e a base de dados recusava com um erro genérico).
  if (semBloco.length > 0) {
    const ids = semBloco.map((p) => p.aula.id);
    const [presencas, sumarios, justificacoes] = await Promise.all([
      prisma.presenca.count({ where: { aulaId: { in: ids } } }),
      prisma.sumario.count({ where: { aulaId: { in: ids } } }),
      prisma.justificacao.count({ where: { aulaId: { in: ids } } }),
    ]);
    if (presencas + sumarios + justificacoes > 0) {
      throw new AppError(
        409,
        "AULA_COM_REGISTOS",
        "Há aulas futuras sem bloco livre do novo formador que já têm presenças, sumário ou justificações registados e não podem ser canceladas. Pede ao novo formador que marque essas horas como livres."
      );
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Se a agenda mudou entretanto (alguém agendou ou cancelou aulas desta UC), recusa em vez de
    // trocar o formador com base numa lista desatualizada.
    await bloquear(tx, "turma_ucs", id);
    const aulasAgora = await tx.aula.count({ where: { turmaUcId: id, data: { gte: hoje } } });
    if (aulasAgora !== aulasFuturas.length) {
      throw new AppError(409, "AGENDA_ALTERADA", "A agenda desta UC foi alterada entretanto — volta a tentar.");
    }
    for (const { aula, bloco } of pares) {
      if (bloco) await tx.aula.update({ where: { id: aula.id }, data: { disponibilidadeId: bloco.id } });
      else await tx.aula.delete({ where: { id: aula.id } });
    }
    return tx.turmaUc.update({ where: { id }, data: { formadorId: novoFormadorId }, include: INCLUDE_RELACOES });
  });

  await notificarFormadorAtribuido(resultado);
  return { turmaUc: await comHoras(resultado), movidas: pares.length - semBloco.length, canceladas: semBloco.length };
}

async function associar(dados) {
  await validarTurmaUcFormador(dados.turmaId, dados.ucId, dados.formadorId);

  const existente = await prisma.turmaUc.findUnique({
    where: { turmaId_ucId: { turmaId: dados.turmaId, ucId: dados.ucId } },
  });
  if (existente && existente.ativo) {
    throw new AppError(409, "UC_JA_ASSOCIADA", "Esta UC já está associada a esta turma.");
  }

  // Já existiu esta associação e foi desativada (a chave turma+UC é única) —
  // reativa-a com o novo formador em vez de criar uma linha nova, mantendo
  // as aulas já dadas ligadas ao mesmo id.
  if (existente && existente.formadorId !== dados.formadorId) {
    await garantirSemAulasFuturas(existente.id);
  }
  const turmaUc = existente
    ? await prisma.turmaUc.update({
        where: { id: existente.id },
        data: { formadorId: dados.formadorId, ativo: true },
        include: INCLUDE_RELACOES,
      })
    : await prisma.turmaUc.create({ data: dados, include: INCLUDE_RELACOES });

  await notificarFormadorAtribuido(turmaUc); // já trata erros internamente (não falha a associação por causa do email)

  return comHoras(turmaUc);
}

async function atualizar(id, dados) {
  const atual = await obterOuFalhar(id);
  const formadorMudou = Boolean(dados.formadorId) && dados.formadorId !== atual.formadorId;
  if (dados.formadorId) {
    const formador = await prisma.user.findUnique({ where: { id: dados.formadorId } });
    if (!formador || formador.role !== "FORMADOR") {
      throw new AppError(422, "FORMADOR_INVALIDO", "O formador indicado não existe ou não tem o papel de Formador.");
    }
    if (!formador.ativo) {
      throw new AppError(422, "FORMADOR_INATIVO", "O formador indicado está inativo.");
    }
  }
  if (formadorMudou) {
    await garantirSemAulasFuturas(id);
  }
  const turmaUc = await prisma.turmaUc.update({
    where: { id },
    data: { formadorId: dados.formadorId ?? atual.formadorId },
    include: INCLUDE_RELACOES,
  });
  if (formadorMudou) {
    await notificarFormadorAtribuido(turmaUc); // já trata erros internamente
  }
  return comHoras(turmaUc);
}

// Antes recusava remover (409 TURMA_UC_COM_AULAS) se já houvesse aulas
// agendadas — era a única forma de evitar o DELETE a falhar por chave
// estrangeira. Agora fica apenas inativa: as aulas já dadas mantêm-se e
// deixa de ser possível agendar novas aulas para esta associação (ver
// aula.service.js). Ver reativar() para desfazer.
async function remover(id) {
  await obterOuFalhar(id);
  await prisma.turmaUc.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  const turmaUc = await obterOuFalhar(id);
  const atualizado = await prisma.turmaUc.update({
    where: { id },
    data: { ativo: true },
    include: INCLUDE_RELACOES,
  });
  return comHoras(atualizado);
}

// Copia as UCs ativas de uma turma para outra, com os mesmos formadores. Não
// copia aulas, notas nem trabalhos — só a estrutura. Ignora (e explica porquê)
// o que não pode ser copiado: UC já associada ao destino, UC desativada no
// catálogo ou formador inativo. Cada formador é notificado, como numa associação normal.
async function copiar(origemTurmaId, destinoTurmaId) {
  if (origemTurmaId === destinoTurmaId) {
    throw new AppError(422, "TURMAS_IGUAIS", "A turma de origem e a de destino têm de ser diferentes.");
  }
  const [origem, destino] = await Promise.all([
    prisma.turma.findUnique({ where: { id: origemTurmaId } }),
    prisma.turma.findUnique({ where: { id: destinoTurmaId } }),
  ]);
  if (!origem || !destino) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  if (!destino.ativo) {
    throw new AppError(422, "TURMA_INATIVA", "A turma de destino está inativa.");
  }

  const [associacoes, jaNoDestino] = await Promise.all([
    prisma.turmaUc.findMany({
      where: { turmaId: origemTurmaId, ativo: true },
      include: { uc: true, formador: { select: { ativo: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.turmaUc.findMany({ where: { turmaId: destinoTurmaId }, select: { ucId: true } }),
  ]);
  const ucsNoDestino = new Set(jaNoDestino.map((t) => t.ucId));

  const copiadas = [];
  const ignoradas = [];
  for (const assoc of associacoes) {
    const rotulo = assoc.uc.abreviatura;
    if (ucsNoDestino.has(assoc.ucId)) ignoradas.push({ uc: rotulo, motivo: "já está associada à turma de destino" });
    else if (!assoc.uc.ativo) ignoradas.push({ uc: rotulo, motivo: "UC desativada no catálogo" });
    else if (!assoc.formador.ativo) ignoradas.push({ uc: rotulo, motivo: "o formador está inativo" });
    else {
      const criada = await prisma.turmaUc.create({
        data: { turmaId: destinoTurmaId, ucId: assoc.ucId, formadorId: assoc.formadorId },
        include: INCLUDE_RELACOES,
      });
      copiadas.push(rotulo);
      await notificarFormadorAtribuido(criada);
    }
  }

  return { copiadas, ignoradas };
}

module.exports = { substituirFormador, copiar, listarDoFormador, listarPorTurma, associar, atualizar, remover, reativar, obterOuFalhar };
