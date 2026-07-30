const request = require("supertest");
const { prisma } = require("../src/lib/prisma");

// Ordem importa por causa das foreign keys: entregas antes de turmas/users.
async function limparBaseDados() {
  await prisma.entrega.deleteMany();
  await prisma.pedidoAcesso.deleteMany();
  await prisma.turma.deleteMany();
  await prisma.user.deleteMany();
}

let contador = 0;

async function criarUtilizadorAutenticado(app, { role = "COORDENADOR", nome, email, password = "Teste123!" } = {}) {
  contador += 1;
  nome = nome || `Utilizador Teste ${contador}`;
  email = email || `utilizador${contador}@teste.pt`;

  const registoRes = await request(app).post("/api/v1/auth/register").send({ nome, email, password, role });
  const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password });

  return { token: loginRes.body.data.token, user: registoRes.body.data };
}

module.exports = { limparBaseDados, criarUtilizadorAutenticado };
