const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { gerarIcs } = require("../lib/ics");
const aulaService = require("./aula.service");

// Subscrição de calendário por URL (Google Calendar, Outlook, Apple: "adicionar
// calendário por URL"). Estes clientes não enviam cabeçalhos de autenticação,
// por isso o URL leva um token. Decisões:
//  - o token é um JWT assinado com JWT_SECRET + o hash da password do
//    utilizador: **mudar a password invalida o link**, e uma conta desativada
//    deixa de receber o calendário — revogação sem precisar de nova tabela;
//  - só dá acesso de leitura ao horário do próprio utilizador (nunca a mais);
//  - não expira (os clientes de calendário não sabem renovar links).
const segredoDe = (user) => `${process.env.JWT_SECRET}:${user.passwordHash}`;

function gerarToken(user) {
  return jwt.sign({ id: user.id, tipo: "calendario" }, segredoDe(user));
}

async function validarToken(token) {
  const bruto = jwt.decode(token);
  if (!bruto || bruto.tipo !== "calendario" || !Number.isInteger(bruto.id) || bruto.id <= 0) {
    throw new AppError(404, "CALENDARIO_NOT_FOUND", "Calendário não encontrado.");
  }
  const user = await prisma.user.findUnique({ where: { id: bruto.id } });
  if (!user || !user.ativo) {
    throw new AppError(404, "CALENDARIO_NOT_FOUND", "Calendário não encontrado.");
  }
  try {
    jwt.verify(token, segredoDe(user));
  } catch {
    throw new AppError(404, "CALENDARIO_NOT_FOUND", "Calendário não encontrado.");
  }
  return user;
}

async function linkDoUtilizador(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return gerarToken(user);
}

// Aulas de 30 dias atrás até 12 meses à frente (o cliente refresca sozinho).
async function gerarCalendario(token) {
  const user = await validarToken(token);
  const de = new Date();
  de.setDate(de.getDate() - 30);
  const ate = new Date();
  ate.setFullYear(ate.getFullYear() + 1);
  const iso = (d) => d.toISOString().slice(0, 10);

  const aulas =
    user.role === "COORDENADOR"
      ? await aulaService.listarGeral({ de: iso(de), ate: iso(ate) })
      : await aulaService.listarMinhas({ id: user.id, role: user.role }, iso(de), iso(ate));

  const nome = user.role === "COORDENADOR" ? "Horário geral" : `Horário — ${user.nome}`;
  return gerarIcs(aulas, nome);
}

module.exports = { linkDoUtilizador, gerarCalendario };
