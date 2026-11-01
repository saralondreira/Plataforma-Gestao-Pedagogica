const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { notificar } = require("../lib/notificacoes");
const { AppError } = require("../utils/AppError");
const path = require("path");
const { UPLOADS_DIR } = require("../config/paths");
const {
  garantirResponsavelOuCoordenador,
  formandosDaTurma,
  formandoComTurma,
} = require("../lib/acesso");

const INCLUDE_AULA = {
  turmaUc: { include: { uc: true, turma: true } },
};

async function obterAulaOuFalhar(aulaId) {
  const aula = await prisma.aula.findUnique({ where: { id: aulaId }, include: INCLUDE_AULA });
  if (!aula) {
    throw new AppError(404, "AULA_NOT_FOUND", "Aula não encontrada.");
  }
  return aula;
}

function removerFicheiroSilencioso(ficheiro) {
  if (ficheiro?.path) fs.unlink(ficheiro.path, () => {});
}

// --- Registo de presenças (formador responsável / coordenação) ---

async function listarDaAula(user, aulaId) {
  const aula = await obterAulaOuFalhar(aulaId);
  garantirResponsavelOuCoordenador(user, aula.turmaUc);

  const [formandos, presencas, justificacoes] = await Promise.all([
    formandosDaTurma(aula.turmaUc.turmaId),
    prisma.presenca.findMany({ where: { aulaId } }),
    prisma.justificacao.findMany({ where: { aulaId } }),
  ]);
  const presencaPorFormando = new Map(presencas.map((p) => [p.formandoId, p]));
  const justificacaoPorFormando = new Map(justificacoes.map((j) => [j.formandoId, j]));

  return {
    aula: {
      id: aula.id,
      data: aula.data,
      horaInicio: aula.horaInicio,
      uc: { abreviatura: aula.turmaUc.uc.abreviatura, nome: aula.turmaUc.uc.nome },
      turma: { codigo: aula.turmaUc.turma.codigo },
    },
    formandos: formandos.map((formando) => {
      const justificacao = justificacaoPorFormando.get(formando.id);
      return {
        formando,
        presenca: presencaPorFormando.get(formando.id)?.estado || null,
        justificacao: justificacao
          ? {
              id: justificacao.id,
              estado: justificacao.estado,
              motivo: justificacao.motivo,
              temAnexo: Boolean(justificacao.anexoUrl),
              notaDecisao: justificacao.notaDecisao,
            }
          : null,
      };
    }),
  };
}

async function registar(user, aulaId, presencas) {
  const aula = await obterAulaOuFalhar(aulaId);
  garantirResponsavelOuCoordenador(user, aula.turmaUc);

  if (aula.data.getTime() > Date.now()) {
    throw new AppError(422, "AULA_FUTURA", "Esta aula ainda não aconteceu — só se registam presenças depois da data da aula.");
  }

  const formandos = await formandosDaTurma(aula.turmaUc.turmaId);
  const idsValidos = new Set(formandos.map((f) => f.id));
  for (const p of presencas) {
    if (!idsValidos.has(p.formandoId)) {
      throw new AppError(422, "FORMANDO_INVALIDO", "Um dos formandos indicados não pertence à turma desta aula.");
    }
  }

  await prisma.$transaction(
    presencas.map((p) =>
      prisma.presenca.upsert({
        where: { aulaId_formandoId: { aulaId, formandoId: p.formandoId } },
        update: { estado: p.estado },
        create: { aulaId, formandoId: p.formandoId, estado: p.estado },
      })
    )
  );

  return listarDaAula(user, aulaId);
}

// --- O que o formando vê (só as suas presenças) ---

async function minhas(userId) {
  const formando = await formandoComTurma(userId);

  const aulas = await prisma.aula.findMany({
    where: { turmaUc: { turmaId: formando.turmaId, ativo: true } },
    include: { turmaUc: { include: { uc: true } } },
    orderBy: [{ data: "desc" }, { horaInicio: "desc" }],
  });
  const aulaIds = aulas.map((a) => a.id);
  const [presencas, justificacoes] = await Promise.all([
    prisma.presenca.findMany({ where: { formandoId: userId, aulaId: { in: aulaIds } } }),
    prisma.justificacao.findMany({ where: { formandoId: userId, aulaId: { in: aulaIds } } }),
  ]);
  const presencaPorAula = new Map(presencas.map((p) => [p.aulaId, p.estado]));
  const justificacaoPorAula = new Map(justificacoes.map((j) => [j.aulaId, j]));

  const lista = aulas.map((aula) => {
    const justificacao = justificacaoPorAula.get(aula.id);
    return {
      aula: { id: aula.id, data: aula.data, horaInicio: aula.horaInicio, modalidade: aula.modalidade },
      uc: { abreviatura: aula.turmaUc.uc.abreviatura, nome: aula.turmaUc.uc.nome },
      presenca: presencaPorAula.get(aula.id) || null,
      justificacao: justificacao
        ? { id: justificacao.id, estado: justificacao.estado, motivo: justificacao.motivo, notaDecisao: justificacao.notaDecisao }
        : null,
    };
  });

  const faltas = lista.filter((l) => l.presenca === "AUSENTE");
  const resumo = {
    aulasRegistadas: lista.filter((l) => l.presenca !== null).length,
    presencas: lista.filter((l) => l.presenca === "PRESENTE").length,
    faltas: faltas.length,
    faltasJustificadas: faltas.filter((l) => l.justificacao?.estado === "ACEITE").length,
  };

  return { resumo, aulas: lista };
}

// --- Justificações de faltas ---

async function submeterJustificacao(userId, { aulaId, motivo }, ficheiro) {
  try {
    const formando = await formandoComTurma(userId);
    const aula = await obterAulaOuFalhar(aulaId);
    if (aula.turmaUc.turmaId !== formando.turmaId) {
      throw new AppError(403, "FORBIDDEN", "Esta aula não é da tua turma.");
    }

    const presenca = await prisma.presenca.findUnique({
      where: { aulaId_formandoId: { aulaId, formandoId: userId } },
    });
    if (!presenca || presenca.estado !== "AUSENTE") {
      throw new AppError(422, "SEM_FALTA", "Só podes justificar faltas já registadas pelo formador.");
    }

    const existente = await prisma.justificacao.findUnique({
      where: { aulaId_formandoId: { aulaId, formandoId: userId } },
    });
    if (existente && existente.estado !== "REJEITADA") {
      throw new AppError(409, "JUSTIFICACAO_JA_SUBMETIDA", "Já submeteste uma justificação para esta falta.");
    }

    const anexoUrl = ficheiro ? `/uploads/justificacoes/${userId}/${ficheiro.filename}` : null;
    const dados = { motivo, anexoUrl, estado: "PENDENTE", decididaPorId: null, decididaEm: null, notaDecisao: null };

    const justificacao = await prisma.justificacao.upsert({
      where: { aulaId_formandoId: { aulaId, formandoId: userId } },
      update: dados,
      create: { aulaId, formandoId: userId, ...dados },
    });

    // Reenviar depois de uma rejeição substitui o anexo: o anterior deixa de ser referenciado, apaga-se do disco.
    if (existente?.anexoUrl && existente.anexoUrl !== anexoUrl) {
      fs.unlink(path.join(UPLOADS_DIR, "justificacoes", String(userId), path.basename(existente.anexoUrl)), () => {});
    }

    await notificar([aula.turmaUc.formadorId], {
      tipo: "JUSTIFICACAO_SUBMETIDA",
      assunto: `Nova justificação de falta — ${aula.turmaUc.uc.abreviatura}`,
      linhas: [`${formando.nome} submeteu uma justificação de falta (UC ${aula.turmaUc.uc.abreviatura}).`, "Consulta-a e decide na plataforma."],
    });

    return justificacao;
  } catch (erro) {
    removerFicheiroSilencioso(ficheiro); // não deixar ficheiros órfãos se a submissão falhou
    throw erro;
  }
}

async function listarJustificacoes(user, estado) {
  const justificacoes = await prisma.justificacao.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(user.role === "FORMADOR" ? { aula: { turmaUc: { formadorId: user.id } } } : {}),
    },
    include: {
      formando: { select: { id: true, nome: true, email: true } },
      aula: {
        select: {
          id: true,
          data: true,
          horaInicio: true,
          turmaUc: { select: { uc: { select: { abreviatura: true, nome: true } }, turma: { select: { codigo: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return justificacoes.map(({ anexoUrl, ...resto }) => ({ ...resto, temAnexo: Boolean(anexoUrl) }));
}

async function obterJustificacaoOuFalhar(id) {
  const justificacao = await prisma.justificacao.findUnique({
    where: { id },
    include: { aula: { include: INCLUDE_AULA } },
  });
  if (!justificacao) {
    throw new AppError(404, "JUSTIFICACAO_NOT_FOUND", "Justificação não encontrada.");
  }
  return justificacao;
}

async function decidir(user, id, { estado, notaDecisao }) {
  const justificacao = await obterJustificacaoOuFalhar(id);
  garantirResponsavelOuCoordenador(user, justificacao.aula.turmaUc);

  if (justificacao.estado !== "PENDENTE") {
    throw new AppError(409, "JUSTIFICACAO_JA_DECIDIDA", "Esta justificação já foi decidida.");
  }

  const decidida = await prisma.justificacao.update({
    where: { id },
    data: { estado, notaDecisao: notaDecisao ?? null, decididaPorId: user.id, decididaEm: new Date() },
  });

  const resultado = estado === "ACEITE" ? "aceite" : "rejeitada";
  await notificar([justificacao.formandoId], {
    tipo: "JUSTIFICACAO_DECIDIDA",
    assunto: `A tua justificação de falta foi ${resultado}`,
    linhas: [`A justificação que submeteste (UC ${justificacao.aula.turmaUc.uc.abreviatura}) foi ${resultado}.`, "Consulta os detalhes na plataforma."],
  });

  return decidida;
}

// Quem pode abrir o anexo: o próprio formando, o formador responsável, a coordenação.
async function obterAnexo(user, id) {
  const justificacao = await obterJustificacaoOuFalhar(id);

  const eODono = user.role === "FORMANDO" && justificacao.formandoId === user.id;
  const eResponsavel = user.role === "FORMADOR" && justificacao.aula.turmaUc.formadorId === user.id;
  if (!eODono && !eResponsavel && user.role !== "COORDENADOR") {
    throw new AppError(403, "FORBIDDEN", "Não tens permissão para ver este anexo.");
  }
  if (!justificacao.anexoUrl) {
    throw new AppError(404, "FICHEIRO_NOT_FOUND", "Esta justificação não tem anexo.");
  }
  return { formandoId: justificacao.formandoId, anexoUrl: justificacao.anexoUrl };
}

// --- Visão da coordenação ---

async function resumoDaTurma(turmaId) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }

  const [formandos, aulas] = await Promise.all([
    formandosDaTurma(turmaId),
    prisma.aula.findMany({
      where: { turmaUc: { turmaId, ativo: true }, data: { lte: new Date() } },
      select: { id: true },
    }),
  ]);
  const aulaIds = aulas.map((a) => a.id);
  const [presencas, aceites] = await Promise.all([
    prisma.presenca.findMany({ where: { aulaId: { in: aulaIds } } }),
    prisma.justificacao.findMany({ where: { aulaId: { in: aulaIds }, estado: "ACEITE" }, select: { aulaId: true, formandoId: true } }),
  ]);
  const justificadas = new Set(aceites.map((j) => `${j.aulaId}:${j.formandoId}`));

  return {
    turma: { id: turma.id, codigo: turma.codigo, designacao: turma.designacao },
    aulasDadas: aulaIds.length,
    formandos: formandos.map((formando) => {
      const dele = presencas.filter((p) => p.formandoId === formando.id);
      const faltas = dele.filter((p) => p.estado === "AUSENTE");
      const faltasJustificadas = faltas.filter((p) => justificadas.has(`${p.aulaId}:${formando.id}`)).length;
      return {
        formando,
        presencas: dele.filter((p) => p.estado === "PRESENTE").length,
        faltas: faltas.length,
        faltasJustificadas,
        faltasInjustificadas: faltas.length - faltasJustificadas,
      };
    }),
  };
}

module.exports = {
  listarDaAula,
  registar,
  minhas,
  submeterJustificacao,
  listarJustificacoes,
  decidir,
  obterAnexo,
  resumoDaTurma,
};
