const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const INCLUDE_RELACOES = {
  formador: { select: { id: true, nome: true, sigla: true } },
  turma: { select: { id: true, codigo: true, designacao: true } },
};

async function listar() {
  return prisma.entrega.findMany({
    include: INCLUDE_RELACOES,
    orderBy: { dataLimite: "asc" },
  });
}

async function listarPorFormador(formadorId) {
  return prisma.entrega.findMany({
    where: { formadorId },
    include: INCLUDE_RELACOES,
    orderBy: { dataLimite: "asc" },
  });
}

async function criar(dados) {
  return prisma.entrega.create({ data: dados, include: INCLUDE_RELACOES });
}

async function atualizar(id, dados) {
  await obterOuFalhar(id);
  return prisma.entrega.update({ where: { id }, data: dados, include: INCLUDE_RELACOES });
}

async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.entrega.delete({ where: { id } });
}

async function marcarComoEntregue(id, submissao) {
  await obterOuFalhar(id);
  return prisma.entrega.update({
    where: { id },
    data: { entregue: true, ...submissao },
    include: INCLUDE_RELACOES,
  });
}

async function obterOuFalhar(id) {
  const entrega = await prisma.entrega.findUnique({ where: { id } });
  if (!entrega) {
    throw new AppError(404, "NOT_FOUND", "Entrega não encontrada.");
  }
  return entrega;
}

module.exports = { listar, listarPorFormador, criar, atualizar, apagar, marcarComoEntregue, obterOuFalhar };
