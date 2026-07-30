const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("POST /api/v1/pedidos-acesso", () => {
  test("não exige autenticação (formulário público)", async () => {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Pedro Candidato",
      email: "pedro@teste.pt",
      cargo: "formador",
      motivo: "Módulo de Programação Web",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe("PENDENTE");
  });

  test("rejeita sem nome/email/cargo", async () => {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({ motivo: "x" });
    expect(res.status).toBe(422);
  });
});
