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

const TEXTO = "Introdução ao HTML: estrutura de uma página, etiquetas semânticas e exercícios práticos.";

// Cenário: aula já dada (2026-09-10) + um mediador (outro formador) atribuído à turma.
async function cenario({ comMediador = true } = {}) {
  const c = await prepararCenarioAcademico(app, { comAula: true });
  const mediador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
  if (comMediador) {
    await request(app).patch(`/api/v1/turmas/${c.turma.id}`).set(comToken(c.coordenador)).send({ mediadorId: mediador.user.id });
  }
  limparTestOutbox();
  return { ...c, mediador, aulaId: c.aula.id };
}

const escrever = (c, texto = TEXTO, quem = c.formador) => request(app).put(`/api/v1/sumarios/aula/${c.aulaId}`).set(comToken(quem)).send({ texto });

describe("Sumários — escrever", () => {
  test("o formador responsável escreve o sumário de uma aula já dada; o mediador é avisado", async () => {
    const c = await cenario();
    const res = await escrever(c);
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("SUBMETIDO");
    expect(res.body.data.escritoPor.id).toBe(c.formador.user.id);

    const avisos = testOutbox.filter((e) => e.tipo === "SUMARIO_SUBMETIDO");
    expect(avisos.map((e) => e.to)).toEqual([c.mediador.user.email]);
    expect(JSON.stringify(avisos[0])).not.toContain("Introdução ao HTML"); // o email não leva o conteúdo
  });

  test("sem mediador, quem valida (e é avisada) é a coordenação", async () => {
    const c = await cenario({ comMediador: false });
    await escrever(c);
    expect(testOutbox.filter((e) => e.tipo === "SUMARIO_SUBMETIDO").map((e) => e.to)).toEqual([c.coordenador.user.email]);
  });

  test("recusa aula futura (422), texto curto (422) e formador de outra UC (403)", async () => {
    const c = await cenario();
    const bloco = await request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data: "2030-03-04", horaInicio: 9, estado: "LIVRE" });
    const futura = (await request(app).post("/api/v1/aulas").set(comToken(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" })).body.data;

    const aF = await request(app).put(`/api/v1/sumarios/aula/${futura.id}`).set(comToken(c.formador)).send({ texto: TEXTO });
    expect(aF.status).toBe(422);
    expect(aF.body.error.code).toBe("AULA_FUTURA");

    expect((await escrever(c, "curto")).status).toBe(422);
    expect((await escrever(c, TEXTO, c.mediador)).status).toBe(403); // o mediador não escreve o sumário de outro formador
  });
});

describe("Sumários — validar", () => {
  test("o mediador valida; o formador é avisado e o sumário deixa de poder ser alterado", async () => {
    const c = await cenario();
    const { id } = (await escrever(c)).body.data;
    limparTestOutbox();

    const res = await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.mediador)).send({ aceite: true });
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("VALIDADO");
    expect(res.body.data.validadoPor.id).toBe(c.mediador.user.id);
    expect(testOutbox.filter((e) => e.tipo === "SUMARIO_VALIDADO").map((e) => e.to)).toEqual([c.formador.user.email]);

    const alterar = await escrever(c, "Outro texto com mais de dez caracteres.");
    expect(alterar.status).toBe(409);
    expect(alterar.body.error.code).toBe("SUMARIO_VALIDADO");
    expect((await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.mediador)).send({ aceite: true })).status).toBe(409);
  });

  test("rejeitar exige motivo; o formador corrige e volta a submeter", async () => {
    const c = await cenario();
    const { id } = (await escrever(c)).body.data;
    const decidir = (corpo, quem = c.mediador) => request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(quem)).send(corpo);

    const semMotivo = await decidir({ aceite: false });
    expect(semMotivo.status).toBe(422);
    expect(semMotivo.body.error.code).toBe("NOTA_OBRIGATORIA");

    const rej = await decidir({ aceite: false, nota: "Falta indicar os exercícios feitos." });
    expect(rej.body.data.estado).toBe("REJEITADO");
    expect(rej.body.data.notaValidacao).toBe("Falta indicar os exercícios feitos.");

    const corrigido = await escrever(c, `${TEXTO} Exercícios 1 a 4 resolvidos.`);
    expect(corrigido.status).toBe(200);
    expect(corrigido.body.data.estado).toBe("SUBMETIDO");
    expect(corrigido.body.data.notaValidacao).toBeNull();
    expect((await decidir({ aceite: true })).body.data.estado).toBe("VALIDADO");
  });

  test("só o mediador da turma ou a coordenação validam (outro formador e o próprio autor: 403)", async () => {
    const c = await cenario();
    const { id } = (await escrever(c)).body.data;
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const decidir = (quem) => request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(quem)).send({ aceite: true });

    expect((await decidir(outro)).status).toBe(403);
    expect((await decidir(c.formador)).status).toBe(403);
    expect((await decidir(c.formando)).status).toBe(403);
    expect((await decidir(c.coordenador)).status).toBe(200);
  });
});

describe("Sumários — mediador que também é o formador da UC", () => {
  test("não valida o próprio sumário: não o vê por validar, recebe 403 e quem é avisada é a coordenação", async () => {
    const c = await cenario({ comMediador: false });
    await request(app).patch(`/api/v1/turmas/${c.turma.id}`).set(comToken(c.coordenador)).send({ mediadorId: c.formador.user.id });
    limparTestOutbox();

    const { id } = (await escrever(c)).body.data;
    expect(testOutbox.filter((e) => e.tipo === "SUMARIO_SUBMETIDO").map((e) => e.to)).toEqual([c.coordenador.user.email]);

    const lista = await request(app).get("/api/v1/sumarios/por-validar").set(comToken(c.formador));
    expect(lista.body.data).toHaveLength(0);
    const proprio = await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.formador)).send({ aceite: true });
    expect(proprio.status).toBe(403);

    const coord = await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.coordenador)).send({ aceite: true });
    expect(coord.status).toBe(200);
  });
});

describe("Sumários — listas", () => {
  test("por-escrever mostra a aula até ser submetida e volta a mostrá-la se for rejeitada", async () => {
    const c = await cenario();
    const lista = async () => (await request(app).get("/api/v1/sumarios/por-escrever").set(comToken(c.formador))).body.data;

    expect((await lista()).map((a) => a.id)).toEqual([c.aulaId]);

    const { id } = (await escrever(c)).body.data;
    expect(await lista()).toHaveLength(0);

    await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.mediador)).send({ aceite: false, nota: "Mais detalhe, por favor." });
    const depois = await lista();
    expect(depois).toHaveLength(1);
    expect(depois[0].sumario.notaValidacao).toBe("Mais detalhe, por favor.");
  });

  test("por-validar: o mediador vê só os das suas turmas, a coordenação todos, um formador qualquer nenhum", async () => {
    const c = await cenario();
    await escrever(c);
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const ver = async (quem) => (await request(app).get("/api/v1/sumarios/por-validar").set(comToken(quem))).body.data;

    expect(await ver(c.mediador)).toHaveLength(1);
    expect(await ver(c.coordenador)).toHaveLength(1);
    expect(await ver(outro)).toHaveLength(0);
    expect((await request(app).get("/api/v1/sumarios/por-validar").set(comToken(c.formando))).status).toBe(403);
  });

  test("o formando só vê os sumários VALIDADOS da sua turma", async () => {
    const c = await cenario();
    const { id } = (await escrever(c)).body.data;
    const ver = () => request(app).get("/api/v1/sumarios/turma").set(comToken(c.formando));

    expect((await ver()).body.data).toHaveLength(0); // submetido ainda não aparece

    await request(app).patch(`/api/v1/sumarios/${id}/decidir`).set(comToken(c.mediador)).send({ aceite: true });
    const res = await ver();
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].texto).toBe(TEXTO);

    const semTurma = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    expect((await request(app).get("/api/v1/sumarios/turma").set(comToken(semTurma))).status).toBe(409);
  });

  test("daAula: formador responsável e mediador veem o sumário; outro formador não", async () => {
    const c = await cenario();
    await escrever(c);
    const ver = (quem) => request(app).get(`/api/v1/sumarios/aula/${c.aulaId}`).set(comToken(quem));
    expect((await ver(c.formador)).body.data.texto).toBe(TEXTO);
    expect((await ver(c.mediador)).body.data.texto).toBe(TEXTO);
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await ver(outro)).status).toBe(403);
  });
});
