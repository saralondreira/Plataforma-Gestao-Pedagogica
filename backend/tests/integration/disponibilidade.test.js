const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("Disponibilidade", () => {
  test("formador define, lista e apaga um bloco de disponibilidade", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });
    expect(criarRes.status).toBe(201);

    const bloqueadoRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 12, estado: "BLOQUEADO", motivo: "Almoço" });
    expect(bloqueadoRes.status).toBe(201);
    expect(bloqueadoRes.body.data.motivo).toBe("Almoço");

    const listarRes = await request(app).get("/api/v1/disponibilidade/minha").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(2);

    const apagarRes = await request(app)
      .delete(`/api/v1/disponibilidade/${criarRes.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(apagarRes.status).toBe(204);
  });

  test("marcar o mesmo bloco duas vezes atualiza em vez de duplicar", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "BLOQUEADO", motivo: "Reunião" });

    const listarRes = await request(app).get("/api/v1/disponibilidade/minha").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(1);
    expect(listarRes.body.data[0].estado).toBe("BLOQUEADO");
  });

  test("coordenador consegue ver a disponibilidade de um formador específico", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    const res = await request(app)
      .get(`/api/v1/disponibilidade/formador/${formador.user.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test("formador não pode ver a disponibilidade de outro formador por esta rota (403)", async () => {
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res = await request(app)
      .get(`/api/v1/disponibilidade/formador/${outroFormador.user.id}`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(res.status).toBe(403);
  });

  test("formador não pode apagar bloco de outro formador (403)", async () => {
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    const res = await request(app)
      .delete(`/api/v1/disponibilidade/${criarRes.body.data.id}`)
      .set("Authorization", `Bearer ${outroFormador.token}`);
    expect(res.status).toBe(403);
  });

  // Apagar deixou de ser DELETE definitivo (flag ativo=false): o bloco some
  // da listagem, mas redefini-lo outra vez (mesmo upsert usado para o criar)
  // marca-o de novo como ativo — não é preciso um endpoint de reativar à parte.
  test("apagar um bloco tira-o da listagem, e redefini-lo outra vez reativa-o", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    await request(app)
      .delete(`/api/v1/disponibilidade/${criarRes.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);

    const listaRes = await request(app).get("/api/v1/disponibilidade/minha").set("Authorization", `Bearer ${token}`);
    expect(listaRes.body.data).toHaveLength(0);

    const redefinirRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });
    expect(redefinirRes.status).toBe(201);
    expect(redefinirRes.body.data.id).toBe(criarRes.body.data.id);

    const listaFinalRes = await request(app).get("/api/v1/disponibilidade/minha").set("Authorization", `Bearer ${token}`);
    expect(listaFinalRes.body.data).toHaveLength(1);
  });

  test("apagar bloco de disponibilidade inexistente devolve 404 BLOCO_NOT_FOUND", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const res = await request(app).delete("/api/v1/disponibilidade/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BLOCO_NOT_FOUND");
  });
});

describe("Ocupação do formador (vista da coordenação)", () => {
  test("a coordenação vê, por bloco, se há aula (com UC e turma), e o formador não vê a de outro", async () => {
    const { coordenador, formador } = await prepararCenarioAcademico(app, { comAula: true });

    const res = await request(app)
      .get(`/api/v1/disponibilidade/formador/${formador.user.id}?de=2026-09-07&ate=2026-09-13`)
      .set({ Authorization: `Bearer ${coordenador.token}` });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].aula.turmaUc.uc.abreviatura).toBe("UC-ACAD");
    expect(res.body.data[0].aula.turmaUc.turma.codigo).toBe("T-ACAD");

    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const proibido = await request(app)
      .get(`/api/v1/disponibilidade/formador/${formador.user.id}`)
      .set({ Authorization: `Bearer ${outro.token}` });
    expect(proibido.status).toBe(403);
  });
});

describe("Pedir ao formador que marque disponibilidade", () => {
  test("a coordenação avisa o formador por email com as horas em falta; formador não pode pedir", async () => {
    const { coordenador, formador } = await prepararCenarioAcademico(app);
    limparTestOutbox();

    const res = await request(app)
      .post("/api/v1/disponibilidade/pedir-marcacao").set(comToken(coordenador))
      .send({ formadorId: formador.user.id, quando: ["2030-04-16 09:00", "2030-04-23 09:00"] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ avisados: 1, horas: 2 });

    const emails = testOutbox.filter((e) => e.tipo === "DISPONIBILIDADE_PEDIDA");
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(formador.user.email);
    expect(JSON.stringify(emails[0])).toContain("2030-04-16 09:00");

    const proibido = await request(app).post("/api/v1/disponibilidade/pedir-marcacao").set(comToken(formador)).send({ formadorId: formador.user.id, quando: ["2030-04-16 09:00"] });
    expect(proibido.status).toBe(403);
  });

  test("recusa formato de data inválido (422), lista vazia (422) e formador inexistente (404)", async () => {
    const { coordenador, formador } = await prepararCenarioAcademico(app);
    const post = (corpo) => request(app).post("/api/v1/disponibilidade/pedir-marcacao").set(comToken(coordenador)).send(corpo);
    expect((await post({ formadorId: formador.user.id, quando: ["amanhã"] })).status).toBe(422);
    expect((await post({ formadorId: formador.user.id, quando: [] })).status).toBe(422);
    expect((await post({ formadorId: 999999, quando: ["2030-04-16 09:00"] })).status).toBe(404);
  });
});
