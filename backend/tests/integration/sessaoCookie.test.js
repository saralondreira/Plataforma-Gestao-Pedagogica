const request = require("supertest");
const bcrypt = require("bcrypt");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados } = require("../helpers");

const ORIGEM = process.env.CORS_ORIGIN || "http://localhost:5500";
const CSRF = { "X-Requested-With": "pedagogica" };

beforeEach(async () => {
  await limparBaseDados();
  await prisma.user.create({
    data: { nome: "Coord Cookie", email: "cookie@teste.pt", passwordHash: await bcrypt.hash("Teste1234!", 10), role: "COORDENADOR" },
  });
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

// Sessão do browser (2026-10-28): o JWT vai num cookie httpOnly em vez do localStorage, com proteção CSRF.

async function entrarComoBrowser() {
  const res = await request(app).post("/api/v1/auth/login").set(CSRF).send({ email: "cookie@teste.pt", password: "Teste1234!" });
  const cookie = (res.headers["set-cookie"] || []).find((c) => c.startsWith("pedagogica_sessao="));
  return { res, cookie, par: cookie ? cookie.split(";")[0] : null };
}

describe("Login por cookie", () => {
  test("define um cookie httpOnly e o browser não recebe o token no corpo", async () => {
    const { res, cookie } = await entrarComoBrowser();
    expect(res.status).toBe(200);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.user.email).toBe("cookie@teste.pt");
  });

  test("os clientes de API (sem o cabeçalho do browser) continuam a receber o token", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "cookie@teste.pt", password: "Teste1234!" });
    expect(res.body.data.token).toEqual(expect.any(String));
  });
});

describe("Pedidos autenticados pelo cookie", () => {
  test("GET com cookie funciona", async () => {
    const { par } = await entrarComoBrowser();
    const res = await request(app).get("/api/v1/auth/me").set("Cookie", par);
    expect(res.status).toBe(200);
  });

  test("pedido que altera dados sem o cabeçalho de segurança é recusado (CSRF)", async () => {
    const { par } = await entrarComoBrowser();
    const res = await request(app).patch("/api/v1/auth/me").set("Cookie", par).send({ nome: "Outro Nome" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALIDO");
    expect((await prisma.user.findUnique({ where: { email: "cookie@teste.pt" } })).nome).toBe("Coord Cookie");
  });

  test("com o cabeçalho de segurança e a origem certa, altera dados", async () => {
    const { par } = await entrarComoBrowser();
    const res = await request(app).patch("/api/v1/auth/me").set("Cookie", par).set(CSRF).set("Origin", ORIGEM).send({ nome: "Novo Nome" });
    expect(res.status).toBe(200);
  });

  test("uma origem estranha é recusada mesmo com o cabeçalho (inclusive em GET)", async () => {
    const { par } = await entrarComoBrowser();
    const post = await request(app).patch("/api/v1/auth/me").set("Cookie", par).set(CSRF).set("Origin", "https://site-malicioso.example").send({ nome: "X Y" });
    expect(post.status).toBe(403);
    const get = await request(app).get("/api/v1/auth/me").set("Cookie", par).set("Origin", "https://site-malicioso.example");
    expect(get.status).toBe(403);
  });

  test("cookie adulterado é recusado com 401", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Cookie", "pedagogica_sessao=nao-e-um-token");
    expect(res.status).toBe(401);
  });

  test("o Bearer continua a funcionar sem cabeçalho CSRF (clientes de API)", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "cookie@teste.pt", password: "Teste1234!" });
    const res = await request(app).patch("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.data.token}`).send({ nome: "Via Bearer" });
    expect(res.status).toBe(200);
  });
});

describe("Terminar sessão", () => {
  test("o logout apaga o cookie", async () => {
    const res = await request(app).post("/api/v1/auth/logout").set(CSRF);
    expect(res.status).toBe(204);
    const apagado = (res.headers["set-cookie"] || []).find((c) => c.startsWith("pedagogica_sessao="));
    expect(apagado).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe("CORS com cookies", () => {
  test("a resposta permite credenciais só à origem da aplicação", async () => {
    const res = await request(app).options("/api/v1/auth/me").set("Origin", ORIGEM).set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-origin"]).toBe(ORIGEM);
  });
});
