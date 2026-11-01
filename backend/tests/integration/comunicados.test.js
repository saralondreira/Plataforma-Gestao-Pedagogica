const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

async function cenario() {
  const c = await prepararCenarioAcademico(app);
  const mediador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
  await request(app).patch(`/api/v1/turmas/${c.turma.id}`).set(comToken(c.coordenador)).send({ mediadorId: mediador.user.id });
  limparTestOutbox();
  return { ...c, mediador };
}

const enviar = (c, quem, corpo = {}) =>
  request(app).post("/api/v1/comunicados").set(comToken(quem)).send({ turmaId: c.turma.id, assunto: "Visita de estudo", corpo: "Na sexta-feira vamos visitar a empresa parceira.", ...corpo });

describe("Comunicados à turma", () => {
  test("o mediador envia; os formandos da turma leem e recebem aviso por email (sem o conteúdo)", async () => {
    const c = await cenario();
    const res = await enviar(c, c.mediador);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ assunto: "Visita de estudo", destinatarios: 1 });
    expect(res.body.data.autor.id).toBe(c.mediador.user.id);

    const avisos = testOutbox.filter((e) => e.tipo === "COMUNICADO_TURMA");
    expect(avisos.map((e) => e.to)).toEqual([c.formando.user.email]);
    expect(JSON.stringify(avisos[0])).not.toContain("empresa parceira");

    const lista = await request(app).get("/api/v1/comunicados/turma").set(comToken(c.formando));
    expect(lista.body.data.map((x) => x.assunto)).toEqual(["Visita de estudo"]);
    expect(lista.body.data[0].corpo).toContain("empresa parceira");
  });

  test("a coordenação também envia; outro formador, o formador da UC e o formando não (403)", async () => {
    const c = await cenario();
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await enviar(c, c.coordenador)).status).toBe(201);
    expect((await enviar(c, outro)).status).toBe(403);
    expect((await enviar(c, c.formador)).status).toBe(403); // responsável pela UC, mas não é o mediador
    expect((await enviar(c, c.formando)).status).toBe(403);
  });

  test("valida os dados e recusa turmas inexistentes", async () => {
    const c = await cenario();
    expect((await enviar(c, c.mediador, { assunto: "x" })).status).toBe(422);
    expect((await enviar(c, c.mediador, { corpo: "" })).status).toBe(422);
    const inexistente = await request(app).post("/api/v1/comunicados").set(comToken(c.mediador)).send({ turmaId: 999999, assunto: "Olá", corpo: "Mensagem de teste" });
    expect(inexistente.status).toBe(404);
  });

  test("o formando só vê os da sua turma; sem turma recebe 409", async () => {
    const c = await cenario();
    await enviar(c, c.mediador);
    const outraTurma = await request(app).post("/api/v1/turmas").set(comToken(c.coordenador)).send({ codigo: "T-OUTRA", designacao: "Outra", dataInicio: "2026-09-01" });
    const deFora = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outraTurma.body.data.id });
    expect((await request(app).get("/api/v1/comunicados/turma").set(comToken(deFora))).body.data).toHaveLength(0);

    const semTurma = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    expect((await request(app).get("/api/v1/comunicados/turma").set(comToken(semTurma))).status).toBe(409);
  });

  test("turmas de envio e enviados: o mediador vê só as suas, a coordenação todas", async () => {
    const c = await cenario();
    await request(app).post("/api/v1/turmas").set(comToken(c.coordenador)).send({ codigo: "T-SEM-MED", designacao: "Sem mediador", dataInicio: "2026-09-01" });
    await enviar(c, c.mediador);

    const turmasMed = await request(app).get("/api/v1/comunicados/turmas").set(comToken(c.mediador));
    expect(turmasMed.body.data.map((t) => t.codigo)).toEqual(["T-ACAD"]);
    const turmasCoord = await request(app).get("/api/v1/comunicados/turmas").set(comToken(c.coordenador));
    expect(turmasCoord.body.data).toHaveLength(2);

    expect((await request(app).get("/api/v1/comunicados/enviados").set(comToken(c.mediador))).body.data).toHaveLength(1);
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await request(app).get("/api/v1/comunicados/enviados").set(comToken(outro))).body.data).toHaveLength(0);
  });

  test("remover: autor, mediador e coordenação; o formando deixa de o ver", async () => {
    const c = await cenario();
    const { id } = (await enviar(c, c.mediador)).body.data;
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const apagar = (quem) => request(app).delete(`/api/v1/comunicados/${id}`).set(comToken(quem));

    expect((await apagar(outro)).status).toBe(403);
    expect((await apagar(c.formando)).status).toBe(403);
    expect((await apagar(c.mediador)).status).toBe(204);
    expect((await apagar(c.mediador)).status).toBe(404);
    expect((await request(app).get("/api/v1/comunicados/turma").set(comToken(c.formando))).body.data).toHaveLength(0);
  });
});
