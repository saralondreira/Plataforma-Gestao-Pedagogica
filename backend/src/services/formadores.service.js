const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const SALT_ROUNDS = 10;

function toPublicFormador(user) {
  const { passwordHash, ...publico } = user;
  return publico;
}

async function listar({ incluirInativos = false } = {}) {
  const formadores = await prisma.user.findMany({
    where: { role: "FORMADOR", ...(incluirInativos ? {} : { ativo: true }) },
    orderBy: { createdAt: "desc" },
  });
  return formadores.map(toPublicFormador);
}

async function criar({ nome, email, password, sigla, turmasQtd, ucsQtd, estadoFormador }) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente && (existente.ativo || existente.role !== "FORMADOR")) {
    throw new AppError(409, "EMAIL_IN_USE", "Este email já tem acesso à plataforma.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Já existiu um formador inativo com este email (foi desativado antes) —
  // em vez de criar uma conta nova, reativa a antiga e atualiza os dados.
  // Preserva o histórico (entregas, UCs lecionadas, disponibilidades) ligado a esse id.
  if (existente) {
    const formador = await prisma.user.update({
      where: { id: existente.id },
      data: { nome, email, passwordHash, sigla, turmasQtd, ucsQtd, estadoFormador, ativo: true },
    });
    return toPublicFormador(formador);
  }

  const formador = await prisma.user.create({
    data: {
      nome,
      email,
      passwordHash,
      role: "FORMADOR",
      sigla,
      turmasQtd,
      ucsQtd,
      estadoFormador,
    },
  });

  return toPublicFormador(formador);
}

async function atualizar(id, dados) {
  await obterOuFalhar(id);
  const formador = await prisma.user.update({ where: { id }, data: dados });
  return toPublicFormador(formador);
}

// Antes fazia DELETE definitivo (prisma.user.delete) — se o formador já tivesse
// entregas, UCs lecionadas ou disponibilidades associadas, a base de dados
// recusava o delete (chave estrangeira) e o pedido falhava. Agora só marca
// a conta como inativa: mantém o histórico e deixa de aparecer nas listagens
// e no login. Ver reativar() para desfazer.
async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.user.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  await obterOuFalhar(id);
  const formador = await prisma.user.update({ where: { id }, data: { ativo: true } });
  return toPublicFormador(formador);
}

async function obterOuFalhar(id) {
  const formador = await prisma.user.findFirst({ where: { id, role: "FORMADOR" } });
  if (!formador) {
    throw new AppError(404, "FORMADOR_NOT_FOUND", "Formador não encontrado.");
  }
  return formador;
}

module.exports = { listar, criar, atualizar, apagar, reativar };
