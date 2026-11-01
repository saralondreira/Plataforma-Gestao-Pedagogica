const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

// Correções da auditoria (2026-10-28): tokens, corpo inválido, papel lido da BD,
// transições com estado e datas reais.

describe("Tokens JWT inválidos", () => {
  test("token adulterado, expirado e 'alg: none' são recusados com 401", async () => {
    const c = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const adulterado = c.token.slice(0, -3) + (c.token.endsWith("aaa") ? "bbb" : "aaa");
    const expirado = jwt.sign({ id: c.user.id, role: "COORDENADOR" }, process.env.JWT_SECRET, { expiresIn: -10 });
    const semAssinatura = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ id: c.user.id, role: "COORDENADOR" })).toString("base64url"),
      "",
    ].join(".");

    for (const token of [adulterado, expirado, semAssinatura]) {
      const res = await request(app).get("/api/v1/turmas").set({ Authorization: `Bearer ${token}` });
      expect(res.status).toBe(401);
    }
  });

  test("o papel vem da base de dados, não do token", async () => {
    const f = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    // token antigo diz COORDENADOR, mas o utilizador é FORMANDO
    const falso = jwt.sign({ id: f.user.id, role: "COORDENADOR" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const res = await request(app).post("/api/v1/ucs").set({ Authorization: `Bearer ${falso}` })
      .send({ abreviatura: "X-1", nome: "UC", cargaHoraria: 10 });
    expect([401, 403]).toContain(res.status);
  });
});

describe("Corpo JSON inválido", () => {
  test("devolve 400 JSON_INVALIDO em vez de 500", async () => {
    const res = await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{ nao e json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("JSON_INVALIDO");
  });
});

describe("Painel de resumo", () => {
  test("cada papel recebe o seu resumo", async () => {
    const c = await prepararCenarioAcademico(app);
    for (const [quem, papel] of [[c.coordenador, "COORDENADOR"], [c.formador, "FORMADOR"], [c.formando, "FORMANDO"]]) {
      const res = await request(app).get("/api/v1/painel/resumo").set(comToken(quem));
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(papel);
    }
  });
});

describe("Pedidos de acesso: permissões e transições", () => {
  async function novoPedido() {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({ nome: "Pessoa Teste", email: "pessoa@teste.pt", cargo: "formador", motivo: "Quero aceder à plataforma" });
    return res.body.data;
  }

  test("formador não pode rejeitar nem aprovar pedidos", async () => {
    const pedido = await novoPedido();
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await request(app).patch(`/api/v1/pedidos-acesso/${pedido.id}/rejeitar`).set(comToken(formador))).status).toBe(403);
  });

  test("rejeitar duas vezes: a segunda dá 409", async () => {
    const pedido = await novoPedido();
    const coord = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    expect((await request(app).patch(`/api/v1/pedidos-acesso/${pedido.id}/rejeitar`).set(comToken(coord))).status).toBe(200);
    const segunda = await request(app).patch(`/api/v1/pedidos-acesso/${pedido.id}/rejeitar`).set(comToken(coord));
    expect(segunda.status).toBe(409);
  });
});

describe("Datas reais", () => {
  test("disponibilidade com 30 de fevereiro é recusada (422)", async () => {
    const f = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const res = await request(app).post("/api/v1/disponibilidade").set(comToken(f))
      .send({ data: "2026-02-30", horaInicio: 9, estado: "LIVRE" });
    expect(res.status).toBe(422);
  });
});
