const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");
const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "documentos");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

const ver = (quem) => request(app).get("/api/v1/painel/conformidade").set(comToken(quem));
const daUc = async (c, quem = c.coordenador) => (await ver(quem)).body.data.ucs.find((u) => u.turmaUcId === c.turmaUc.id);

// Aula de 2030 só para o horário deixar de estar "sem aulas futuras".
async function agendarAulaFutura(c) {
  const bloco = await request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data: "2030-03-04", horaInicio: 9, estado: "LIVRE" });
  await request(app).post("/api/v1/aulas").set(comToken(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });
}

const escreverSumario = (c) =>
  request(app).put(`/api/v1/sumarios/aula/${c.aula.id}`).set(comToken(c.formador)).send({ texto: "Introdução ao HTML: estrutura e exercícios." });
const enviarDocumento = (c) =>
  request(app).post(`/api/v1/documentos/turma-uc/${c.turmaUc.id}`).set(comToken(c.formador)).attach("ficheiro", Buffer.from("x"), "slides.pdf");

describe("Conformidade — semáforos por UC", () => {
  test("aula dada sem sumário (há mais de 2 dias) e sem documentos: VERMELHO", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const uc = await daUc(c);
    expect(uc.estado).toBe("VERMELHO");
    expect(uc.sumarios).toMatchObject({ estado: "VERMELHO", aulasDadas: 1, emFalta: 1, emAtraso: 1, validados: 0 });
    expect(uc.documentos).toMatchObject({ estado: "VERMELHO", total: 0 });
    expect(uc.horario.estado).toBe("AMARELO"); // 49h por agendar e nenhuma aula futura
  });

  test("sumário submetido fica AMARELO; validado e com documento fica VERDE", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    await agendarAulaFutura(c);
    await enviarDocumento(c);

    const { id } = (await escreverSumario(c)).body.data;
    let uc = await daUc(c);
    expect(uc.sumarios).toMatchObject({ estado: "AMARELO", porValidar: 1, emFalta: 0 });
    expect(uc.documentos.estado).toBe("VERDE");
    expect(uc.horario.estado).toBe("VERDE");
    expect(uc.estado).toBe("AMARELO");

    await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.coordenador)).send({ aceite: true });
    uc = await daUc(c);
    expect(uc.sumarios).toMatchObject({ estado: "VERDE", validados: 1 });
    expect(uc.estado).toBe("VERDE");
  });

  test("um sumário rejeitado conta como em falta; remover o único documento volta a dar VERMELHO", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    await agendarAulaFutura(c);
    const doc = (await enviarDocumento(c)).body.data;
    const { id } = (await escreverSumario(c)).body.data;

    await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.coordenador)).send({ aceite: false, nota: "Falta detalhe." });
    expect((await daUc(c)).sumarios).toMatchObject({ estado: "VERMELHO", emFalta: 1 });

    await request(app).delete(`/api/v1/documentos/${doc.id}`).set(comToken(c.formador));
    expect((await daUc(c)).documentos).toMatchObject({ estado: "VERMELHO", total: 0 });
  });

  test("UC sem aulas dadas nem documentos não é penalizada; turma concluída sai do cálculo", async () => {
    const c = await prepararCenarioAcademico(app);
    await agendarAulaFutura(c);
    const uc = await daUc(c);
    expect(uc.sumarios).toMatchObject({ estado: "VERDE", aulasDadas: 0 });
    expect(uc.documentos.estado).toBe("VERDE");

    await prisma.turma.update({ where: { id: c.turma.id }, data: { estado: "CONCLUIDA" } });
    expect((await ver(c.coordenador)).body.data.total).toBe(0);
  });

  test("ordena o pior primeiro e conta por cor", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const outra = await request(app).post("/api/v1/ucs").set(comToken(c.coordenador)).send({ abreviatura: "UC-OK", nome: "UC sem aulas", cargaHoraria: 1 });
    await request(app).post("/api/v1/turma-ucs").set(comToken(c.coordenador)).send({ turmaId: c.turma.id, ucId: outra.body.data.id, formadorId: c.formador.user.id });

    const res = (await ver(c.coordenador)).body.data;
    expect(res).toMatchObject({ total: 2, vermelho: 1 });
    expect(res.ucs[0].estado).toBe("VERMELHO");
    expect(res.ucs[0].uc).toBe("UC-ACAD");
  });
});

describe("Conformidade — permissões e painel", () => {
  test("o formador vê só as suas UCs; formando não tem acesso", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    expect((await ver(c.formador)).body.data.ucs).toHaveLength(1);
    expect((await ver(outro)).body.data.ucs).toHaveLength(0);
    expect((await ver(c.formando)).status).toBe(403);
  });

  test("o resumo da coordenação traz as contagens e as UCs a vermelho", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const res = await request(app).get("/api/v1/painel/resumo").set(comToken(c.coordenador));
    expect(res.body.data.conformidade).toMatchObject({ total: 1, vermelho: 1, verde: 0 });
    expect(res.body.data.conformidade.piores[0].uc).toBe("UC-ACAD");
  });
});

describe("Conformidade — avisar formadores", () => {
  test("a coordenação avisa por email o formador de cada UC a vermelho (um email por formador)", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    limparTestOutbox();

    const res = await request(app).post("/api/v1/painel/conformidade/avisar").set(comToken(c.coordenador));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ formadoresAvisados: 1, ucsEmFalha: 1 });

    const emails = testOutbox.filter((e) => e.tipo === "CONFORMIDADE_EM_FALHA");
    expect(emails.map((e) => e.to)).toEqual([c.formador.user.email]);
    expect(emails[0].texto).toContain("UC-ACAD");
    expect(emails[0].texto).toContain("sem sumário");
    expect(emails[0].texto).toContain("nenhum documento");
  });

  test("sem UCs a vermelho não envia nada; só a coordenação pode pedir", async () => {
    const c = await prepararCenarioAcademico(app);
    limparTestOutbox();
    const res = await request(app).post("/api/v1/painel/conformidade/avisar").set(comToken(c.coordenador));
    expect(res.body.data).toEqual({ formadoresAvisados: 0, ucsEmFalha: 0 });
    expect(testOutbox).toHaveLength(0);

    expect((await request(app).post("/api/v1/painel/conformidade/avisar").set(comToken(c.formador))).status).toBe(403);
    expect((await request(app).post("/api/v1/painel/conformidade/avisar").set(comToken(c.formando))).status).toBe(403);
  });
});
