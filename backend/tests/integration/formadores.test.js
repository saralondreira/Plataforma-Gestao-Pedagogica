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

describe("Formadores", () => {
  test("criar formador cria uma conta de login real, listagem só mostra role=FORMADOR", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Ana Formadora",
        email: "ana.formadora@teste.pt",
        password: "Teste123!",
        sigla: "AF",
        turmasQtd: 2,
        ucsQtd: 3,
      });

    expect(criarRes.status).toBe(201);
    expect(criarRes.body.data.passwordHash).toBeUndefined();

    const loginFormadorRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ana.formadora@teste.pt", password: "Teste123!" });
    expect(loginFormadorRes.status).toBe(200);
    expect(loginFormadorRes.body.data.user.role).toBe("FORMADOR");

    const listarRes = await request(app).get("/api/v1/formadores").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(1);
  });

  test("coordenador não aparece na lista de formadores", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const listarRes = await request(app).get("/api/v1/formadores").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(0);
  });
});
