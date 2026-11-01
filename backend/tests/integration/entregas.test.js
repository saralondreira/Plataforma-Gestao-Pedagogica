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

  test("formador não pode listar todas as entregas, criar, editar, apagar, reativar nem marcar como entregue pela coordenação (403)", async () => {
    const { formador, entrega } = await prepararCenario();

    const listarRes = await request(app).get("/api/v1/entregas").set("Authorization", `Bearer ${formador.token}`);
    expect(listarRes.status).toBe(403);

    const criarRes = await request(app)
      .post("/api/v1/entregas")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ formadorId: formador.user.id, turmaId: entrega.turmaId, documento: "Outro", dataLimite: "2026-08-20" });
    expect(criarRes.status).toBe(403);

    const editarRes = await request(app)
      .patch(`/api/v1/entregas/${entrega.id}`)
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ documento: "Alterado" });
    expect(editarRes.status).toBe(403);

    const apagarRes = await request(app)
      .delete(`/api/v1/entregas/${entrega.id}`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(apagarRes.status).toBe(403);

    const reativarRes = await request(app)
      .patch(`/api/v1/entregas/${entrega.id}/reativar`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(reativarRes.status).toBe(403);

    const marcarRes = await request(app)
      .patch(`/api/v1/entregas/${entrega.id}/marcar-entregue`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(marcarRes.status).toBe(403);
  });

  test("apagar (desativar) uma entrega tira-a das listagens, e reativar traz-a de volta", async () => {
    const { coordenador, formador, entrega } = await prepararCenario();

    const apagarRes = await request(app)
      .delete(`/api/v1/entregas/${entrega.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(apagarRes.status).toBe(204);

    const listarRes = await request(app).get("/api/v1/entregas").set("Authorization", `Bearer ${coordenador.token}`);
    expect(listarRes.body.data).toHaveLength(0);

    const minhasRes = await request(app)
      .get("/api/v1/entregas/minhas")
      .set("Authorization", `Bearer ${formador.token}`);
    expect(minhasRes.body.data).toHaveLength(0);

    const reativarRes = await request(app)
      .patch(`/api/v1/entregas/${entrega.id}/reativar`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(reativarRes.status).toBe(200);
    expect(reativarRes.body.data.ativo).toBe(true);

    const listarFinalRes = await request(app).get("/api/v1/entregas").set("Authorization", `Bearer ${coordenador.token}`);
    expect(listarFinalRes.body.data).toHaveLength(1);
  });

  test("editar entrega inexistente devolve 404 ENTREGA_NOT_FOUND", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/entregas/999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ dataLimite: "2026-12-31" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ENTREGA_NOT_FOUND");
  });

  test("o ficheiro submetido só é descarregável com autenticação, pelo formador dono ou pela coordenação", async () => {
    const { coordenador, formador, entrega } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    await request(app)
      .post(`/api/v1/entregas/${entrega.id}/submeter`)
      .set("Authorization", `Bearer ${formador.token}`)
      .attach("ficheiro", Buffer.from("conteudo de teste"), "teste.txt");

    // O caminho antigo (estático e público) deixou de existir.
    // Usa o caminho REAL do ficheiro acabado de carregar (um nome inventado dava 404 de qualquer forma).
    const minhas = await request(app).get("/api/v1/entregas/minhas").set("Authorization", `Bearer ${formador.token}`);
    const caminhoReal = minhas.body.data.find((e) => e.id === entrega.id)?.submissaoFicheiroUrl;
    expect(caminhoReal).toMatch(/^\/uploads\/entregas\//);
    expect((await request(app).get(caminhoReal)).status).toBe(404);
    const semAuthInventado = await request(app).get(`/uploads/entregas/${entrega.id}/qualquer.txt`);
    expect(semAuthInventado.status).toBe(404);

    const anonimo = await request(app).get(`/api/v1/entregas/${entrega.id}/ficheiro`);
    expect(anonimo.status).toBe(401);

    const intruso = await request(app)
      .get(`/api/v1/entregas/${entrega.id}/ficheiro`)
      .set("Authorization", `Bearer ${outroFormador.token}`);
    expect(intruso.status).toBe(403);

    const dono = await request(app)
      .get(`/api/v1/entregas/${entrega.id}/ficheiro`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(dono.status).toBe(200);

    const coord = await request(app)
      .get(`/api/v1/entregas/${entrega.id}/ficheiro`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(coord.status).toBe(200);
  });

  test("entrega sem ficheiro submetido devolve 404 FICHEIRO_NOT_FOUND", async () => {
    const { coordenador, entrega } = await prepararCenario();

    const res = await request(app)
      .get(`/api/v1/entregas/${entrega.id}/ficheiro`)
      .set("Authorization", `Bearer ${coordenador.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("FICHEIRO_NOT_FOUND");
  });

  test("não se pode submeter ficheiro nem exceção numa entrega desativada (422 ENTREGA_INATIVA)", async () => {
    const { coordenador, formador, entrega } = await prepararCenario();

    await request(app).delete(`/api/v1/entregas/${entrega.id}`).set("Authorization", `Bearer ${coordenador.token}`);

    const submeter = await request(app)
      .post(`/api/v1/entregas/${entrega.id}/submeter`)
      .set("Authorization", `Bearer ${formador.token}`)
      .attach("ficheiro", Buffer.from("x"), "x.txt");
    expect(submeter.status).toBe(422);
    expect(submeter.body.error.code).toBe("ENTREGA_INATIVA");

    const excecao = await request(app)
      .post(`/api/v1/entregas/${entrega.id}/excecao`)
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ nota: "Enviado por email" });
    expect(excecao.status).toBe(422);
    expect(excecao.body.error.code).toBe("ENTREGA_INATIVA");
  });
});
