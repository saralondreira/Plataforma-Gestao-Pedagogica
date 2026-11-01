const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { enviarNotificacao } = require("../lib/mailer");
const { impressaoDaPassword } = require("../lib/sessao");

const SALT_ROUNDS = 10;

function toPublicUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, ph: impressaoDaPassword(user.passwordHash) }, process.env.JWT_SECRET, {
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

  // Conta desativada (flag ativo=false) — impede novos logins. O middleware
  // requireAuth também verifica ativo na base de dados a cada pedido, por
  // isso um token já emitido deixa de funcionar assim que a conta é
  // desativada, sem ter de esperar que expire.
  if (!user.ativo) {
    throw new AppError(403, "CONTA_INATIVA", "Esta conta foi desativada.");
  }

  const token = signToken(user);
  return { token, user: toPublicUser(user) };
}

async function getById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, "UTILIZADOR_NOT_FOUND", "Utilizador não encontrado.");
  }
  return toPublicUser(user);
}

async function updateProfile(id, dados) {
  const user = await prisma.user.update({ where: { id }, data: dados });
  return toPublicUser(user);
}

// --- Recuperação de palavra-passe ---
// Token sem tabela: JWT assinado com JWT_SECRET + passwordHash atual. Como o
// hash muda quando a palavra-passe muda, o token deixa de valer à primeira
// utilização (e também se a palavra-passe for mudada por outra via).
const VALIDADE_RECUPERACAO = "1h";

const segredoDeRecuperacao = (user) => `${process.env.JWT_SECRET}:${user.passwordHash}`;

function urlDeRecuperacao(token) {
  const base = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5500").replace(/\/$/, "");
  return `${base}/pages/redefinir-password.html#token=${token}`;
}

// Responde sempre da mesma maneira (exista ou não o email) para não revelar
// quem tem conta. Falhas no envio só ficam no log.
async function pedirRecuperacao(email) {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) return;

    const token = jwt.sign({ id: user.id, finalidade: "recuperar-password" }, segredoDeRecuperacao(user), { expiresIn: VALIDADE_RECUPERACAO });
    await enviarNotificacao({
      to: user.email,
      nome: user.nome,
      tipo: "RECUPERAR_PASSWORD",
      assunto: "Recuperação da palavra-passe",
      linhas: [
        "Recebemos um pedido para redefinir a palavra-passe da tua conta.",
        `Abre esta ligação (válida durante 1 hora e só funciona uma vez): ${urlDeRecuperacao(token)}`,
        "Se não foste tu, ignora este email — a tua palavra-passe não muda.",
      ],
    });
  } catch (erro) {
    console.error("[auth] Falha ao processar a recuperação de palavra-passe:", erro.message);
  }
}

async function redefinirPassword(token, password) {
  const invalido = new AppError(400, "TOKEN_INVALIDO", "A ligação é inválida ou já expirou — pede uma nova.");
  const decodificado = jwt.decode(token);
  if (!decodificado || typeof decodificado.id !== "number") throw invalido;

  const user = await prisma.user.findUnique({ where: { id: decodificado.id } });
  if (!user || !user.ativo) throw invalido;

  try {
    const payload = jwt.verify(token, segredoDeRecuperacao(user));
    if (payload.finalidade !== "recuperar-password") throw invalido;
  } catch {
    throw invalido;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Só atualiza se a palavra-passe ainda for a mesma com que o token foi verificado: dois pedidos
  // simultâneos com a mesma ligação não podem ter ambos sucesso (uso único a sério).
  const { count } = await prisma.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash }, data: { passwordHash } });
  if (count !== 1) throw invalido;
}

module.exports = { register, login, getById, updateProfile, toPublicUser, pedirRecuperacao, redefinirPassword };
