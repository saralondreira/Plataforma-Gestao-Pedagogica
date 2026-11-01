const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, prepararCenarioAcademico, comToken } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("Pesquisa global (coordenação)", () => {
  test("encontra turmas, formadores, formandos e UCs, sem expor passwordHash", async () => {
    const { coordenador, formador, formando } = await prepararCenarioAcademico(app);

    const turma = await request(app).get("/api/v1/pesquisa?q=T-ACAD").set(comToken(coordenador));
    expect(turma.status).toBe(200);
    expect(turma.body.data.turmas.map((t) => t.codigo)).toEqual(["T-ACAD"]);

    const uc = await request(app).get("/api/v1/pesquisa?q=Académica").set(comToken(coordenador));
    expect(uc.body.data.ucs[0].abreviatura).toBe("UC-ACAD");
    expect(uc.body.data.turmas).toHaveLength(1); // "Turma Académica" também

    const pessoas = await request(app).get(`/api/v1/pesquisa?q=${encodeURIComponent("Utilizador Teste")}`).set(comToken(coordenador));
    expect(pessoas.body.data.formadores.map((f) => f.id)).toContain(formador.user.id);
    expect(pessoas.body.data.formandos.map((f) => f.id)).toContain(formando.user.id);
    expect(pessoas.body.data.formandos[0].turma.codigo).toBe("T-ACAD");
    expect(JSON.stringify(pessoas.body)).not.toContain("passwordHash");
  });

  test("ignora registos desativados, recusa termos curtos e só a coordenação pesquisa", async () => {
    const { coordenador, formador, formando } = await prepararCenarioAcademico(app);
    await request(app).delete(`/api/v1/formadores/${formador.user.id}`).set(comToken(coordenador));
    const r = await request(app).get(`/api/v1/pesquisa?q=${encodeURIComponent("Utilizador Teste")}`).set(comToken(coordenador));
    expect(r.body.data.formadores.map((f) => f.id)).not.toContain(formador.user.id);

    expect((await request(app).get("/api/v1/pesquisa?q=a").set(comToken(coordenador))).status).toBe(422);
    expect((await request(app).get("/api/v1/pesquisa?q=teste").set(comToken(formando))).status).toBe(403);
    expect((await request(app).get("/api/v1/pesquisa?q=teste")).status).toBe(401);
  });
});
