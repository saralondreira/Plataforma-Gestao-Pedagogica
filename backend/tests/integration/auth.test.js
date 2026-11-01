const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("POST /api/v1/auth/register", () => {
  // Esta rota passou a exigir um coordenador autenticado — ver PLANEAMENTO.md,
  // "Auditoria de rotas e permissões" (2026-09-09). Antes era pública e
  // deixava escolher o role, o que permitia a qualquer pessoa criar-se a si
  // própria uma conta de coordenador sem passar pelo fluxo de Pedidos de Acesso.

  test("exige autenticação (401 sem token)", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      nome: "Sem Token", email: "semtoken@teste.pt", password: "Teste123!", role: "COORDENADOR",
    });

    expect(res.status).toBe(401);
  });

  test("só um coordenador pode registar novos utilizadores (403 para formador)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Tentativa", email: "tentativa@teste.pt", password: "Teste123!", role: "COORDENADOR" });

    expect(res.status).toBe(403);
  });

  test("coordenador regista um novo utilizador e nunca recebe a password", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Teste Coordenador", email: "coord@teste.pt", password: "Teste123!", role: "COORDENADOR" });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("coord@teste.pt");
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  test("rejeita email duplicado com 409", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Primeiro Utilizador", email: "dup@teste.pt", password: "Teste123!", role: "COORDENADOR" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Segundo Utilizador", email: "dup@teste.pt", password: "Teste123!", role: "COORDENADOR" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  test("rejeita dados inválidos com 422", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const res = await request(app)
      .post("/api/v1/auth/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "A", email: "nao-e-email", password: "123", role: "COORDENADOR" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login", () => {
  test("devolve um JWT válido para credenciais corretas", async () => {
    await criarUtilizadorAutenticado(app, { role: "FORMADOR", email: "login@teste.pt", password: "Teste123!" });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "login@teste.pt", password: "Teste123!",
    });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.role).toBe("FORMADOR");
  });

  test("rejeita password errada com 401", async () => {
    await criarUtilizadorAutenticado(app, { role: "COORDENADOR", email: "x@teste.pt", password: "Teste123!" });

    const res = await request(app).post("/api/v1/auth/login").send({
      email: "x@teste.pt", password: "password-errada",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/v1/auth/me", () => {
  test("exige autenticação (401 sem token)", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("devolve os dados do utilizador autenticado", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR", email: "me@teste.pt" });

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@teste.pt");
  });
});
