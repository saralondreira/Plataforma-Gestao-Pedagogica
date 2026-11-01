const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const INCLUDE_RELACOES = {
  formador: { select: { id: true, nome: true, sigla: true } },
  turma: { select: { id: true, codigo: true, designacao: true } },
};

async function listar({ incluirInativos = false } = {}) {
  return prisma.entrega.findMany({
    where: incluirInativos ? {} : { ativo: true },
    include: INCLUDE_RELACOES,
    orderBy: { dataLimite: "asc" },
  });
}

async function listarPorFormador(formadorId, { incluirInativos = false } = {}) {
  return prisma.entrega.findMany({
    where: { formadorId, ...(incluirInativos ? {} : { ativo: true }) },
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

// Antes fazia DELETE definitivo. Agora só marca a entrega como inativa —
// mantém o histórico de submissões já feitas. Ver reativar() para desfazer.
async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.entrega.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  await obterOuFalhar(id);
  return prisma.entrega.update({ where: { id }, data: { ativo: true }, include: INCLUDE_RELACOES });
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
    throw new AppError(404, "ENTREGA_NOT_FOUND", "Entrega não encontrada.");
  }
  return entrega;
}

module.exports = { listar, listarPorFormador, criar, atualizar, apagar, reativar, marcarComoEntregue, obterOuFalhar };
