const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const SALT_ROUNDS = 10; // igual ao de auth.service.js

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

async function validarTurma(turmaId) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  if (!turma.ativo) {
    throw new AppError(422, "TURMA_INATIVA", "Esta turma está inativa.");
  }
}

// A coordenação cria a conta diretamente (sem passar por um Pedido de Acesso), como
// nos formadores. Se já existiu um formando inativo com este email, reativa-se essa
// conta em vez de criar outra: mantém as notas, presenças e entregas ligadas a esse id.
async function criar({ nome, email, password, turmaId }) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente && (existente.ativo || existente.role !== "FORMANDO")) {
    throw new AppError(409, "EMAIL_IN_USE", "Este email já tem acesso à plataforma.");
  }
  if (turmaId) await validarTurma(turmaId);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const dados = { nome, email, passwordHash, turmaId: turmaId ?? null };

  const formando = existente
    ? await prisma.user.update({ where: { id: existente.id }, data: { ...dados, ativo: true }, include: INCLUDE_TURMA })
    : await prisma.user.create({ data: { ...dados, role: "FORMANDO" }, include: INCLUDE_TURMA });
  return toPublicFormando(formando);
}

// Corrige o nome, o email e/ou a turma. Mudar a palavra-passe continua a ser feito
// pela recuperação de palavra-passe (o formando recebe uma ligação por email).
async function atualizar(id, { nome, email, turmaId }) {
  await obterOuFalhar(id);

  if (email !== undefined) {
    const outro = await prisma.user.findUnique({ where: { email } });
    if (outro && outro.id !== id) {
      throw new AppError(409, "EMAIL_IN_USE", "Este email já tem acesso à plataforma.");
    }
  }
  if (turmaId) await validarTurma(turmaId);

  const data = {};
  if (nome !== undefined) data.nome = nome;
  if (email !== undefined) data.email = email;
  if (turmaId !== undefined) data.turmaId = turmaId;

  const formando = await prisma.user.update({ where: { id }, data, include: INCLUDE_TURMA });
  return toPublicFormando(formando);
}

// Desativa em vez de apagar (mantém notas, presenças e entregas). A conta deixa de
// poder fazer login: o estado é lido da base de dados em cada pedido.
async function desativar(id) {
  await obterOuFalhar(id);
  await prisma.user.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  await obterOuFalhar(id);
  const formando = await prisma.user.update({ where: { id }, data: { ativo: true }, include: INCLUDE_TURMA });
  return toPublicFormando(formando);
}

// A coordenação repõe a palavra-passe (ex.: o formando perdeu o acesso ao email). Como a sessão
// está ligada à palavra-passe, as sessões abertas deixam de valer logo.
async function reporPassword(id, password) {
  await obterOuFalhar(id);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

module.exports = { listar, criar, atualizar, atualizarTurma, desativar, reativar, reporPassword };
