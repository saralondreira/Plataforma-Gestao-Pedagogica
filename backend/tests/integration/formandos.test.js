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

async function criarTurma(token, overrides = {}) {
  const res = await request(app)
    .post("/api/v1/turmas")
    .set("Authorization", `Bearer ${token}`)
    .send({ codigo: "T-2026-X", designacao: "Turma Teste", dataInicio: "2026-09-01", ...overrides });
  return res.body.data;
}

describe("Formandos", () => {
  test("exige autenticação para listar", async () => {
    const res = await request(app).get("/api/v1/formandos");
    expect(res.status).toBe(401);
  });

  test("só a coordenação pode listar ou mudar turma de formandos (403 para outros papéis)", async () => {
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const formando = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    const listarRes = await request(app).get("/api/v1/formandos").set("Authorization", `Bearer ${formador.token}`);
    expect(listarRes.status).toBe(403);

    const mudarRes = await request(app)
      .patch(`/api/v1/formandos/${formando.user.id}/turma`)
      .set("Authorization", `Bearer ${formando.token}`)
      .send({ turmaId: null });
    expect(mudarRes.status).toBe(403);
  });

  test("listagem só mostra utilizadores com role=FORMANDO, com a turma incluída", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const turma = await criarTurma(tokenCoordenador);
    await prisma.user.update({ where: { id: formando.id }, data: { turmaId: turma.id } });

    const listarRes = await request(app).get("/api/v1/formandos").set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(listarRes.status).toBe(200);
    expect(listarRes.body.data).toHaveLength(1);
    expect(listarRes.body.data[0].role).toBe("FORMANDO");
    expect(listarRes.body.data[0].turma).toMatchObject({ id: turma.id, codigo: turma.codigo });
    expect(listarRes.body.data[0].passwordHash).toBeUndefined();
  });

  test("por omissão a listagem não mostra formandos desativados, mas ?incluirInativos=true mostra", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    await prisma.user.update({ where: { id: formando.id }, data: { ativo: false } });

    const semInativosRes = await request(app)
      .get("/api/v1/formandos")
      .set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(semInativosRes.body.data).toHaveLength(0);

    const comInativosRes = await request(app)
      .get("/api/v1/formandos?incluirInativos=true")
      .set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(comInativosRes.body.data).toHaveLength(1);
    expect(comInativosRes.body.data[0].ativo).toBe(false);
  });

  test("muda a turma de um formando e depois remove-a (turmaId: null)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const turma = await criarTurma(tokenCoordenador);

    const atribuirRes = await request(app)
      .patch(`/api/v1/formandos/${formando.id}/turma`)
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ turmaId: turma.id });
    expect(atribuirRes.status).toBe(200);
    expect(atribuirRes.body.data.turma.id).toBe(turma.id);

    const removerRes = await request(app)
      .patch(`/api/v1/formandos/${formando.id}/turma`)
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ turmaId: null });
    expect(removerRes.status).toBe(200);
    expect(removerRes.body.data.turma).toBeNull();
  });

  test("mudar turma de formando inexistente devolve 404 FORMANDO_NOT_FOUND", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/formandos/999999/turma")
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ turmaId: null });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("FORMANDO_NOT_FOUND");
  });

  test("associar a uma turma inexistente devolve 404 TURMA_NOT_FOUND", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    const res = await request(app)
      .patch(`/api/v1/formandos/${formando.id}/turma`)
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ turmaId: 999999 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TURMA_NOT_FOUND");
  });

  test("associar a uma turma desativada devolve 422 TURMA_INATIVA", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const turma = await criarTurma(tokenCoordenador);

    await request(app).delete(`/api/v1/turmas/${turma.id}`).set("Authorization", `Bearer ${tokenCoordenador}`);

    const res = await request(app)
      .patch(`/api/v1/formandos/${formando.id}/turma`)
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ turmaId: turma.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("TURMA_INATIVA");
  });

  test("turmaId é obrigatório no corpo (ainda que null) — corpo vazio é rejeitado com 422 VALIDATION_ERROR", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    const res = await request(app)
      .patch(`/api/v1/formandos/${formando.id}/turma`)
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
