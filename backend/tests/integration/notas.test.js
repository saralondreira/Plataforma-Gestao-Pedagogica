const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("Notas", () => {
  test("formador responsável lança uma nota, vê-a na lista e pode corrigi-la (a mesma nota é atualizada)", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);

    const lancarRes = await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(formador))
      .send({ valor: 14.5, observacoes: "Bom trabalho" });
    expect(lancarRes.status).toBe(200);
    expect(lancarRes.body.data.valor).toBe(14.5);

    const listaRes = await request(app).get(`/api/v1/notas/turma-uc/${turmaUc.id}`).set(comToken(formador));
    expect(listaRes.status).toBe(200);
    expect(listaRes.body.data.formandos).toHaveLength(1);
    expect(listaRes.body.data.formandos[0].formando.id).toBe(formando.user.id);
    expect(listaRes.body.data.formandos[0].nota.valor).toBe(14.5);

    const corrigirRes = await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(formador))
      .send({ valor: 16 });
    expect(corrigirRes.body.data.id).toBe(lancarRes.body.data.id);
    expect(corrigirRes.body.data.valor).toBe(16);
  });

  test("rejeita notas fora da escala 0–20 (422)", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);

    for (const valor of [-1, 21]) {
      const res = await request(app)
        .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
        .set(comToken(formador))
        .send({ valor });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("um formador que não é o responsável por esta UC não vê nem lança notas (403)", async () => {
    const { formando, turmaUc } = await prepararCenarioAcademico(app);
    const intruso = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const listaRes = await request(app).get(`/api/v1/notas/turma-uc/${turmaUc.id}`).set(comToken(intruso));
    expect(listaRes.status).toBe(403);

    const lancarRes = await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(intruso))
      .send({ valor: 10 });
    expect(lancarRes.status).toBe(403);
  });

  test("não se lança nota a um formando que não pertence à turma (422 FORMANDO_INVALIDO)", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenarioAcademico(app);

    const outraTurmaRes = await request(app)
      .post("/api/v1/turmas").set(comToken(coordenador))
      .send({ codigo: "T-OUTRA", designacao: "Outra Turma", dataInicio: "2026-09-01" });
    const forasteiro = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outraTurmaRes.body.data.id });

    const res = await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${forasteiro.user.id}`)
      .set(comToken(formador))
      .send({ valor: 12 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("FORMANDO_INVALIDO");
  });

  test("o formando só vê as suas notas, e não pode lançar nem listar as da turma", async () => {
    const { coordenador, formador, formando, turma, turmaUc } = await prepararCenarioAcademico(app);
    const colega = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: turma.id });

    for (const [f, valor] of [[formando, 15], [colega, 8]]) {
      await request(app)
        .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${f.user.id}`)
        .set(comToken(formador))
        .send({ valor });
    }

    const minhasRes = await request(app).get("/api/v1/notas/minhas").set(comToken(formando));
    expect(minhasRes.status).toBe(200);
    expect(minhasRes.body.data).toHaveLength(1);
    expect(minhasRes.body.data[0].valor).toBe(15);
    expect(minhasRes.body.data[0].turmaUc.uc.abreviatura).toBe("UC-ACAD");

    const listaRes = await request(app).get(`/api/v1/notas/turma-uc/${turmaUc.id}`).set(comToken(formando));
    expect(listaRes.status).toBe(403);

    const lancarRes = await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(formando))
      .send({ valor: 20 });
    expect(lancarRes.status).toBe(403);

    const semToken = await request(app).get("/api/v1/notas/minhas");
    expect(semToken.status).toBe(401);
  });

  test("a coordenação vê a pauta da turma (formandos × UCs); o formador não (403)", async () => {
    const { coordenador, formador, formando, turma, turmaUc } = await prepararCenarioAcademico(app);

    await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(formador))
      .send({ valor: 17 });

    const pautaRes = await request(app).get(`/api/v1/notas/pauta/turma/${turma.id}`).set(comToken(coordenador));
    expect(pautaRes.status).toBe(200);
    expect(pautaRes.body.data.ucs).toHaveLength(1);
    expect(pautaRes.body.data.formandos).toHaveLength(1);
    expect(pautaRes.body.data.notas).toEqual([
      { turmaUcId: turmaUc.id, formandoId: formando.user.id, valor: 17 },
    ]);

    const formadorRes = await request(app).get(`/api/v1/notas/pauta/turma/${turma.id}`).set(comToken(formador));
    expect(formadorRes.status).toBe(403);

    const inexistente = await request(app).get("/api/v1/notas/pauta/turma/999999").set(comToken(coordenador));
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("TURMA_NOT_FOUND");
  });

  test("GET /turma-ucs/minhas devolve só as UCs do formador autenticado", async () => {
    const { formador } = await prepararCenarioAcademico(app);
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res = await request(app).get("/api/v1/turma-ucs/minhas").set(comToken(formador));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].uc.abreviatura).toBe("UC-ACAD");

    const vazio = await request(app).get("/api/v1/turma-ucs/minhas").set(comToken(outro));
    expect(vazio.body.data).toHaveLength(0);
  });
});

describe("Histórico de notas", () => {
  test("regista cada alteração (valor anterior/novo e quem alterou) e ignora reenvios iguais", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);
    const url = `/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`;

    await request(app).put(url).set(comToken(formador)).send({ valor: 12 });
    await request(app).put(url).set(comToken(formador)).send({ valor: 12 }); // igual — não regista
    await request(app).put(url).set(comToken(formador)).send({ valor: 15, observacoes: "Repetiu o teste" });

    const res = await request(app).get(`${url}/historico`).set(comToken(formador));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].valorAnterior).toBe(12);
    expect(res.body.data[0].valorNovo).toBe(15);
    expect(res.body.data[0].observacoesNovas).toBe("Repetiu o teste");
    expect(res.body.data[0].alteradaPor.id).toBe(formador.user.id);
    expect(res.body.data[1].valorAnterior).toBeNull();
    expect(res.body.data[1].valorNovo).toBe(12);
  });

  test("formando não pode ver o histórico (403) e formador de outra UC também não", async () => {
    const { formando, turmaUc } = await prepararCenarioAcademico(app);
    const url = `/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}/historico`;

    expect((await request(app).get(url).set(comToken(formando))).status).toBe(403);

    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await request(app).get(url).set(comToken(outro))).status).toBe(403);
  });
});
