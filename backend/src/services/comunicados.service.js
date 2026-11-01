const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { notificar } = require("../lib/notificacoes");
const { formandosDaTurma, formandoComTurma } = require("../lib/acesso");

const INCLUDE = {
  autor: { select: { id: true, nome: true } },
  turma: { select: { id: true, codigo: true, designacao: true } },
};

// Quem pode comunicar com uma turma: a coordenação, ou o mediador dessa turma.
function garantirPodeComunicar(user, turma) {
  if (user.role === "COORDENADOR") return;
  if (user.role === "FORMADOR" && turma.mediadorId === user.id) return;
  throw new AppError(403, "FORBIDDEN", "Só o mediador da turma (ou a coordenação) pode enviar comunicados a esta turma.");
}

// Turmas a que o utilizador pode enviar (para o formulário).
async function turmasEnvio(user) {
  return prisma.turma.findMany({
    where: { ativo: true, estado: { not: "CONCLUIDA" }, ...(user.role === "COORDENADOR" ? {} : { mediadorId: user.id }) },
    select: { id: true, codigo: true, designacao: true },
    orderBy: { codigo: "asc" },
  });
}

async function enviar(user, { turmaId, assunto, corpo }) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma || !turma.ativo) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  garantirPodeComunicar(user, turma);

  const comunicado = await prisma.comunicado.create({ data: { turmaId, autorId: user.id, assunto, corpo }, include: INCLUDE });

  const formandos = await formandosDaTurma(turmaId);
  await notificar(formandos.map((f) => f.id), {
    tipo: "COMUNICADO_TURMA",
    assunto: `Novo comunicado — ${turma.codigo}`,
    linhas: [`Tens um novo comunicado para a turma ${turma.codigo}. Consulta-o na plataforma.`],
  });
  return { ...comunicado, destinatarios: formandos.length };
}

// Mediador: os das suas turmas; coordenação: todos.
async function enviados(user) {
  return prisma.comunicado.findMany({
    where: { ativo: true, ...(user.role === "COORDENADOR" ? {} : { turma: { mediadorId: user.id } }) },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

async function daTurmaDoFormando(user) {
  const formando = await formandoComTurma(user.id);
  return prisma.comunicado.findMany({ where: { turmaId: formando.turmaId, ativo: true }, include: INCLUDE, orderBy: { createdAt: "desc" } });
}

// Remove o autor, o mediador da turma ou a coordenação.
async function remover(user, id) {
  const comunicado = await prisma.comunicado.findUnique({ where: { id }, include: { turma: true } });
  if (!comunicado || !comunicado.ativo) {
    throw new AppError(404, "COMUNICADO_NOT_FOUND", "Comunicado não encontrado.");
  }
  if (user.role !== "COORDENADOR" && comunicado.autorId !== user.id && comunicado.turma.mediadorId !== user.id) {
    throw new AppError(403, "FORBIDDEN", "Não podes remover este comunicado.");
  }
  await prisma.comunicado.update({ where: { id }, data: { ativo: false } });
}

module.exports = { enviar, enviados, turmasEnvio, daTurmaDoFormando, remover };
