const { prisma } = require("../lib/prisma");
const { bloquear } = require("../lib/bloqueios");
const { AppError } = require("../utils/AppError");
const { notificar } = require("../lib/notificacoes");
const {
  obterTurmaUcOuFalhar,
  garantirResponsavelOuCoordenador,
  formandosDaTurma,
  garantirFormandoDaTurma,
} = require("../lib/acesso");

// Lista os formandos da turma desta UC, cada um com a nota já lançada (ou null).
async function listarDaTurmaUc(user, turmaUcId) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);

  const [formandos, notas] = await Promise.all([
    formandosDaTurma(turmaUc.turmaId),
    prisma.nota.findMany({ where: { turmaUcId } }),
  ]);
  const notaPorFormando = new Map(notas.map((n) => [n.formandoId, n]));

  return {
    turmaUc: {
      id: turmaUc.id,
      uc: { abreviatura: turmaUc.uc.abreviatura, nome: turmaUc.uc.nome },
      turma: { codigo: turmaUc.turma.codigo, designacao: turmaUc.turma.designacao },
    },
    formandos: formandos.map((formando) => ({ formando, nota: notaPorFormando.get(formando.id) || null })),
  };
}

async function lancar(user, turmaUcId, formandoId, { valor, observacoes }) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);
  if (!turmaUc.ativo) {
    throw new AppError(422, "TURMA_UC_INATIVA", "Esta UC está desativada nesta turma — não é possível lançar notas.");
  }
  await garantirFormandoDaTurma(formandoId, turmaUc.turmaId);

  const novasObservacoes = observacoes ?? null;
  const nota = await prisma.$transaction(async (tx) => {
    // Dois lançamentos em simultâneo na mesma UC esperam um pelo outro: o histórico fica coerente.
    await bloquear(tx, "turma_ucs", turmaUcId);
    const anterior = await tx.nota.findUnique({ where: { turmaUcId_formandoId: { turmaUcId, formandoId } } });
    const guardada = await tx.nota.upsert({
      where: { turmaUcId_formandoId: { turmaUcId, formandoId } },
      update: { valor, observacoes: novasObservacoes, lancadaPorId: user.id },
      create: { turmaUcId, formandoId, valor, observacoes: novasObservacoes, lancadaPorId: user.id },
    });
    // Só regista no histórico se algo mudou (reenviar o mesmo valor não polui a auditoria).
    if (!anterior || anterior.valor !== valor || (anterior.observacoes ?? null) !== novasObservacoes) {
      await tx.notaHistorico.create({
        data: {
          turmaUcId,
          formandoId,
          valorAnterior: anterior ? anterior.valor : null,
          valorNovo: valor,
          observacoesAnteriores: anterior ? anterior.observacoes : null,
          observacoesNovas: novasObservacoes,
          alteradaPorId: user.id,
        },
      });
    }
    return guardada;
  });

  await notificar([formandoId], {
    tipo: "NOTA_LANCADA",
    assunto: `Nova nota em ${turmaUc.uc.abreviatura}`,
    linhas: [`Foi lançada (ou atualizada) a tua nota na UC ${turmaUc.uc.abreviatura} — ${turmaUc.uc.nome}.`, "Consulta-a na plataforma."],
  });

  return nota;
}

// Histórico de alterações de uma nota (mais recente primeiro) — só o formador
// responsável pela UC ou a coordenação.
async function historico(user, turmaUcId, formandoId) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);
  await garantirFormandoDaTurma(formandoId, turmaUc.turmaId);

  return prisma.notaHistorico.findMany({
    where: { turmaUcId, formandoId },
    include: { alteradaPor: { select: { id: true, nome: true } } },
    orderBy: { id: "desc" },
  });
}

// O formando só vê as suas próprias notas.
async function listarMinhas(userId) {
  return prisma.nota.findMany({
    where: { formandoId: userId, turmaUc: { ativo: true } },
    include: {
      turmaUc: {
        select: {
          id: true,
          uc: { select: { abreviatura: true, nome: true } },
          formador: { select: { nome: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

// Pauta de uma turma (coordenação): formandos × UCs com a nota de cada um.
async function pautaDaTurma(turmaId) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }

  const [formandos, turmaUcs] = await Promise.all([
    formandosDaTurma(turmaId),
    prisma.turmaUc.findMany({
      where: { turmaId, ativo: true },
      include: { uc: { select: { abreviatura: true, nome: true } } },
      orderBy: { uc: { abreviatura: "asc" } },
    }),
  ]);
  const notas = await prisma.nota.findMany({
    where: { turmaUcId: { in: turmaUcs.map((t) => t.id) }, formandoId: { in: formandos.map((f) => f.id) } },
    select: { turmaUcId: true, formandoId: true, valor: true },
  });

  return {
    turma: { id: turma.id, codigo: turma.codigo, designacao: turma.designacao },
    ucs: turmaUcs.map((t) => ({ turmaUcId: t.id, abreviatura: t.uc.abreviatura, nome: t.uc.nome })),
    formandos,
    notas,
  };
}

module.exports = { listarDaTurmaUc, lancar, historico, listarMinhas, pautaDaTurma };
