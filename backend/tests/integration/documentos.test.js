const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "documentos");
const HOJE = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

async function cenario() {
  const c = await prepararCenarioAcademico(app);
  limparTestOutbox();
  return c;
}

const enviar = (c, quem = c.formador, nome = "apontamentos.pdf", conteudo = "conteudo", extra = {}) => {
  const pedido = request(app).post(`/api/v1/documentos/turma-uc/${c.turmaUc.id}`).set(comToken(quem));
  if (extra.categoria) pedido.field("categoria", extra.categoria);
  return pedido.attach("ficheiro", Buffer.from(conteudo), nome);
};

describe("Documentos — enviar", () => {
  test("o formador responsável envia; o nome oficial é IDCurso_UC_Data.ext e os formandos são avisados", async () => {
    const c = await cenario();
    await prisma.turma.update({ where: { id: c.turma.id }, data: { idCursoIEFP: "IEFP 123" } });

    const res = await enviar(c);
    expect(res.status).toBe(201);
    expect(res.body.data.nomePadrao).toBe(`IEFP-123_UC-ACAD_${HOJE}.pdf`);
    expect(res.body.data.nomeOriginal).toBe("apontamentos.pdf");
    expect(res.body.data.enviadoPor.id).toBe(c.formador.user.id);

    expect(testOutbox.filter((e) => e.tipo === "DOCUMENTO_NOVO").map((e) => e.to)).toEqual([c.formando.user.email]);
  });

  test("sem ID do IEFP usa o código da turma; no mesmo dia o nome ganha _v2", async () => {
    const c = await cenario();
    const a = await enviar(c);
    const b = await enviar(c);
    expect(a.body.data.nomePadrao).toBe(`T-ACAD_UC-ACAD_${HOJE}.pdf`);
    expect(b.body.data.nomePadrao).toBe(`T-ACAD_UC-ACAD_${HOJE}_v2.pdf`);
  });

  test("recusa outro formador (403), formando (403), tipo inválido (422) e pedido sem ficheiro (422)", async () => {
    const c = await cenario();
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await enviar(c, outro)).status).toBe(403);
    expect((await enviar(c, c.formando)).status).toBe(403);

    const invalido = await enviar(c, c.formador, "virus.exe");
    expect(invalido.status).toBe(422);
    expect(invalido.body.error.code).toBe("TIPO_FICHEIRO_INVALIDO");

    const vazio = await request(app).post(`/api/v1/documentos/turma-uc/${c.turmaUc.id}`).set(comToken(c.formador));
    expect(vazio.status).toBe(422);
  });

  test("a coordenação também pode enviar, e a categoria é validada", async () => {
    const c = await cenario();
    expect((await enviar(c, c.coordenador, "plano.docx", "x", { categoria: "PLANO" })).body.data.categoria).toBe("PLANO");
    expect((await enviar(c, c.coordenador, "plano.docx", "x", { categoria: "XPTO" })).status).toBe(422);
  });
});

describe("Documentos — ler e descarregar", () => {
  test("responsável, coordenação, mediador e formandos da turma veem; estranhos não", async () => {
    const c = await cenario();
    await enviar(c);
    const mediador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    await request(app).patch(`/api/v1/turmas/${c.turma.id}`).set(comToken(c.coordenador)).send({ mediadorId: mediador.user.id });
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const outraTurma = await request(app).post("/api/v1/turmas").set(comToken(c.coordenador)).send({ codigo: "T-OUTRA", designacao: "Outra", dataInicio: "2026-09-01" });
    const formandoDeFora = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outraTurma.body.data.id });

    const ver = (quem) => request(app).get(`/api/v1/documentos/turma-uc/${c.turmaUc.id}`).set(comToken(quem));
    for (const quem of [c.formador, c.coordenador, mediador, c.formando]) {
      const res = await ver(quem);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }
    expect((await ver(outroFormador)).status).toBe(403);
    expect((await ver(formandoDeFora)).status).toBe(403);
  });

  test("o formando descarrega com o nome oficial; GET /documentos/turma junta as UCs da turma", async () => {
    const c = await cenario();
    const { id, nomePadrao } = (await enviar(c, c.formador, "slides.pdf", "ola mundo")).body.data;

    const res = await request(app).get(`/api/v1/documentos/${id}/ficheiro`).set(comToken(c.formando));
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(nomePadrao);
    expect(res.body.toString()).toBe("ola mundo");

    const turma = await request(app).get("/api/v1/documentos/turma").set(comToken(c.formando));
    expect(turma.body.data.map((d) => d.id)).toEqual([id]);

    const semTurma = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    expect((await request(app).get("/api/v1/documentos/turma").set(comToken(semTurma))).status).toBe(409);
    expect((await request(app).get(`/api/v1/documentos/${id}/ficheiro`).set(comToken(semTurma))).status).toBe(409);
  });
});

describe("Documentos — remover e histórico", () => {
  test("remover esconde do formando mas mantém no histórico do responsável e da coordenação", async () => {
    const c = await cenario();
    const { id } = (await enviar(c)).body.data;
    const remover = (quem) => request(app).delete(`/api/v1/documentos/${id}`).set(comToken(quem));
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    expect((await remover(outro)).status).toBe(403);
    expect((await remover(c.formando)).status).toBe(403);
    const removido = await remover(c.formador);
    expect(removido.status).toBe(200);
    expect(removido.body.data.ativo).toBe(false);
    expect((await remover(c.formador)).status).toBe(409);

    const lista = (quem, q = "") => request(app).get(`/api/v1/documentos/turma-uc/${c.turmaUc.id}${q}`).set(comToken(quem));
    expect((await lista(c.formando)).body.data).toHaveLength(0);
    expect((await lista(c.formando, "?historico=1")).body.data).toHaveLength(0); // o formando nunca vê o histórico
    expect((await lista(c.formador)).body.data).toHaveLength(0);
    expect((await lista(c.formador, "?historico=1")).body.data).toHaveLength(1);
    expect((await lista(c.coordenador, "?historico=1")).body.data[0].removidoEm).not.toBeNull();

    expect((await request(app).get(`/api/v1/documentos/${id}/ficheiro`).set(comToken(c.formando))).status).toBe(404);
    expect((await request(app).get(`/api/v1/documentos/${id}/ficheiro`).set(comToken(c.formador))).status).toBe(200);
  });
});
