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

describe("Turmas", () => {
  test("exige autenticação para listar", async () => {
    const res = await request(app).get("/api/v1/turmas");
    expect(res.status).toBe(401);
  });

  test("cria, lista, atualiza e apaga uma turma (ciclo completo)", async () => {
    const { token } = await criarUtilizadorAutenticado(app);

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-2026-A", designacao: "Programação Web", dataInicio: "2026-09-01" });

    expect(criarRes.status).toBe(201);
    const idTurma = criarRes.body.data.id;
    expect(criarRes.body.data.estado).toBe("PLANEADA");

    const listarRes = await request(app).get("/api/v1/turmas").set("Authorization", `Bearer ${token}`);
    expect(listarRes.status).toBe(200);
    expect(listarRes.body.data).toHaveLength(1);

    const atualizarRes = await request(app)
      .patch(`/api/v1/turmas/${idTurma}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ estado: "EM_CURSO" });
    expect(atualizarRes.status).toBe(200);
    expect(atualizarRes.body.data.estado).toBe("EM_CURSO");

    const apagarRes = await request(app)
      .delete(`/api/v1/turmas/${idTurma}`)
      .set("Authorization", `Bearer ${token}`);
    expect(apagarRes.status).toBe(204);

    const listarFinalRes = await request(app).get("/api/v1/turmas").set("Authorization", `Bearer ${token}`);
    expect(listarFinalRes.body.data).toHaveLength(0);
  });

  test("rejeita código de turma duplicado com 409", async () => {
    const { token } = await criarUtilizadorAutenticado(app);
    const dados = { codigo: "T-DUP", designacao: "Turma", dataInicio: "2026-09-01" };

    await request(app).post("/api/v1/turmas").set("Authorization", `Bearer ${token}`).send(dados);
    const res = await request(app).post("/api/v1/turmas").set("Authorization", `Bearer ${token}`).send(dados);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CODIGO_EM_USO");
  });

  test("apagar turma inexistente devolve 404", async () => {
    const { token } = await criarUtilizadorAutenticado(app);
    const res = await request(app).delete("/api/v1/turmas/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
