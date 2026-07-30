const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado } = require("../helpers");

const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "entregas");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

async function prepararCenario() {
  const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
  const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

  const turmaRes = await request(app)
    .post("/api/v1/turmas")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ codigo: "T-ENT-1", designacao: "Turma Entregas", dataInicio: "2026-09-01" });

  const entregaRes = await request(app)
    .post("/api/v1/entregas")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({
      formadorId: formador.user.id,
      turmaId: turmaRes.body.data.id,
      documento: "Sumários",
      dataLimite: "2026-08-20",
    });

  return { coordenador, formador, turma: turmaRes.body.data, entrega: entregaRes.body.data };
}

describe("Entregas", () => {
  test("coordenador cria um aviso com formador e turma reais (FK)", async () => {
    const { entrega, formador, turma } = await prepararCenario();
    expect(entrega.formadorId).toBe(formador.user.id);
    expect(entrega.turmaId).toBe(turma.id);
    expect(entrega.entregue).toBe(false);
  });

  test("GET /entregas/minhas só devolve as entregas do formador autenticado", async () => {
    const { formador } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const resFormador = await request(app).get("/api/v1/entregas/minhas").set("Authorization", `Bearer ${formador.token}`);
    expect(resFormador.body.data).toHaveLength(1);

    const resOutro = await request(app).get("/api/v1/entregas/minhas").set("Authorization", `Bearer ${outroFormador.token}`);
    expect(resOutro.body.data).toHaveLength(0);
  });

  test("formador submete um ficheiro e a entrega passa a entregue", async () => {
    const { formador, entrega } = await prepararCenario();

    const res = await request(app)
      .post(`/api/v1/entregas/${entrega.id}/submeter`)
      .set("Authorization", `Bearer ${formador.token}`)
      .attach("ficheiro", Buffer.from("conteudo de teste"), "teste.txt");

    expect(res.status).toBe(200);
    expect(res.body.data.entregue).toBe(true);
    expect(res.body.data.submissaoTipo).toBe("FICHEIRO");
    expect(res.body.data.submissaoFicheiroUrl).toMatch(new RegExp(`/uploads/entregas/${entrega.id}/`));
  });

  test("formador não pode submeter uma entrega de outro formador (403)", async () => {
    const { entrega } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res = await request(app)
      .post(`/api/v1/entregas/${entrega.id}/submeter`)
      .set("Authorization", `Bearer ${outroFormador.token}`)
      .attach("ficheiro", Buffer.from("x"), "x.txt");

    expect(res.status).toBe(403);
  });

  test("formador marca exceção (sem ficheiro) com nota", async () => {
    const { formador, entrega } = await prepararCenario();

    const res = await request(app)
      .post(`/api/v1/entregas/${entrega.id}/excecao`)
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ nota: "Entregue por email à coordenação" });

    expect(res.status).toBe(200);
    expect(res.body.data.entregue).toBe(true);
    expect(res.body.data.submissaoTipo).toBe("EXCECAO");
    expect(res.body.data.submissaoNota).toBe("Entregue por email à coordenação");
  });

  test("coordenador marca manualmente como entregue", async () => {
    const { coordenador, entrega } = await prepararCenario();

    const res = await request(app)
      .patch(`/api/v1/entregas/${entrega.id}/marcar-entregue`)
      .set("Authorization", `Bearer ${coordenador.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.submissaoTipo).toBe("COORDENACAO");
  });
});
