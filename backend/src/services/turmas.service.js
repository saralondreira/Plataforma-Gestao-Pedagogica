const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

async function listar() {
  return prisma.turma.findMany({ orderBy: { createdAt: "desc" } });
}

async function criar(dados) {
  const existente = await prisma.turma.findUnique({ where: { codigo: dados.codigo } });
  if (existente) {
    throw new AppError(409, "CODIGO_EM_USO", "Já existe uma turma com este código.");
  }
  return prisma.turma.create({ data: dados });
}

async function atualizar(id, dados) {
  await obterOuFalhar(id);
  return prisma.turma.update({ where: { id }, data: dados });
}

async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.turma.delete({ where: { id } });
}

async function obterOuFalhar(id) {
  const turma = await prisma.turma.findUnique({ where: { id } });
  if (!turma) {
    throw new AppError(404, "NOT_FOUND", "Turma não encontrada.");
  }
  return turma;
}

module.exports = { listar, criar, atualizar, apagar };
