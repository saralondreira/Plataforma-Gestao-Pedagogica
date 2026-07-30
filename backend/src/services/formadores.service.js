const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const SALT_ROUNDS = 10;

function toPublicFormador(user) {
  const { passwordHash, ...publico } = user;
  return publico;
}

async function listar() {
  const formadores = await prisma.user.findMany({
    where: { role: "FORMADOR" },
    orderBy: { createdAt: "desc" },
  });
  return formadores.map(toPublicFormador);
}

async function criar({ nome, email, password, sigla, turmasQtd, ucsQtd, estadoFormador }) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    throw new AppError(409, "EMAIL_IN_USE", "Este email já tem acesso à plataforma.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
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

async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.user.delete({ where: { id } });
}

async function obterOuFalhar(id) {
  const formador = await prisma.user.findFirst({ where: { id, role: "FORMADOR" } });
  if (!formador) {
    throw new AppError(404, "NOT_FOUND", "Formador não encontrado.");
  }
  return formador;
}

module.exports = { listar, criar, atualizar, apagar };
