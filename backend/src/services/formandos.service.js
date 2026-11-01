const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const INCLUDE_TURMA = { turma: { select: { id: true, codigo: true, designacao: true } } };

function toPublicFormando(user) {
  const { passwordHash, ...publico } = user;
  return publico;
}

async function listar({ incluirInativos = false } = {}) {
  const formandos = await prisma.user.findMany({
    where: { role: "FORMANDO", ...(incluirInativos ? {} : { ativo: true }) },
    include: INCLUDE_TURMA,
    orderBy: { createdAt: "desc" },
  });
  return formandos.map(toPublicFormando);
}

async function obterOuFalhar(id) {
  const formando = await prisma.user.findFirst({ where: { id, role: "FORMANDO" } });
  if (!formando) {
    throw new AppError(404, "FORMANDO_NOT_FOUND", "Formando não encontrado.");
  }
  return formando;
}

// Única razão de existir deste serviço: mudar a turma de um formando DEPOIS
// de a conta já existir — no momento de aprovar o Pedido de Acesso já é
// possível escolher a turma (pedidosAcesso.service.js), mas isso só cobre a
// primeira atribuição. Isto cobre mudar de turma a meio do curso, ou
// atribuir uma turma a quem ainda não tinha nenhuma. Ver PLANEAMENTO.md,
// "Gestão de Formandos" (2026-09-10). turmaId a null remove o formando de
// qualquer turma.
async function atualizarTurma(id, turmaId) {
  await obterOuFalhar(id);

  if (turmaId) {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) {
      throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
    }
    if (!turma.ativo) {
      throw new AppError(422, "TURMA_INATIVA", "Esta turma está inativa.");
    }
  }

  const formando = await prisma.user.update({
    where: { id },
    data: { turmaId: turmaId ?? null },
    include: INCLUDE_TURMA,
  });
  return toPublicFormando(formando);
}

module.exports = { listar, atualizarTurma };
