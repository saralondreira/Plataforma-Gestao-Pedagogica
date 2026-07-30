const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const SALT_ROUNDS = 10;

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

async function register({ nome, email, password, role }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "EMAIL_IN_USE", "Este email já tem acesso à plataforma.");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { nome, email, passwordHash, role },
  });

  return toPublicUser(user);
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "As credenciais estão incorretas.");
  }

  const senhaValida = await bcrypt.compare(password, user.passwordHash);
  if (!senhaValida) {
    throw new AppError(401, "INVALID_CREDENTIALS", "As credenciais estão incorretas.");
  }

  const token = signToken(user);
  return { token, user: toPublicUser(user) };
}

async function getById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "Utilizador não encontrado.");
  }
  return toPublicUser(user);
}

module.exports = { register, login, getById, toPublicUser };
