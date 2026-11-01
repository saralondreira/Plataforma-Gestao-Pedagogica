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

describe("Turmas", () => {
  test("exige autenticação para listar", async () => {
    const res = await request(app).get("/api/v1/turmas");
    expect(res.status).toBe(401);
  });

  test("cria, lista, atualiza e apaga uma turma (ciclo completo)", async () => {
    const { token } = await criarUtilizadorAutenticado(app);

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-2026-A", designacao: "Programação Web", dataInicio: "2026-09-01" });

    expect(criarRes.status).toBe(201);
    const idTurma = criarRes.body.data.id;
    expect(criarRes.body.data.estado).toBe("PLANEADA");

    const listarRes = await request(app).get("/api/v1/turmas").set("Authorization", `Bearer ${token}`);
    expect(listarRes.status).toBe(200);
    expect(listarRes.body.data).toHaveLength(1);

    const atualizarRes = await request(app)
      .patch(`/api/v1/turmas/${idTurma}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ estado: "EM_CURSO" });
    expect(atualizarRes.status).toBe(200);
    expect(atualizarRes.body.data.estado).toBe("EM_CURSO");

    const apagarRes = await request(app)
      .delete(`/api/v1/turmas/${idTurma}`)
      .set("Authorization", `Bearer ${token}`);
    expect(apagarRes.status).toBe(204);

    const listarFinalRes = await request(app).get("/api/v1/turmas").set("Authorization", `Bearer ${token}`);
    expect(listarFinalRes.body.data).toHaveLength(0);
  });

  test("rejeita código de turma duplicado com 409", async () => {
    const { token } = await criarUtilizadorAutenticado(app);
    const dados = { codigo: "T-DUP", designacao: "Turma", dataInicio: "2026-09-01" };

    await request(app).post("/api/v1/turmas").set("Authorization", `Bearer ${token}`).send(dados);
    const res = await request(app).post("/api/v1/turmas").set("Authorization", `Bearer ${token}`).send(dados);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CODIGO_EM_USO");
  });

  test("apagar turma inexistente devolve 404", async () => {
    const { token } = await criarUtilizadorAutenticado(app);
    const res = await request(app).delete("/api/v1/turmas/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TURMA_NOT_FOUND");
  });

  test("turma desativada aparece com ?incluirInativos=true e pode ser reativada", async () => {
    const { token } = await criarUtilizadorAutenticado(app);

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-REATIVAR", designacao: "Turma a reativar", dataInicio: "2026-09-01" });
    const turmaId = criarRes.body.data.id;

    await request(app).delete(`/api/v1/turmas/${turmaId}`).set("Authorization", `Bearer ${token}`);

    const listaComInativosRes = await request(app)
      .get("/api/v1/turmas?incluirInativos=true")
      .set("Authorization", `Bearer ${token}`);
    expect(listaComInativosRes.body.data).toHaveLength(1);
    expect(listaComInativosRes.body.data[0].ativo).toBe(false);

    const reativarRes = await request(app)
      .patch(`/api/v1/turmas/${turmaId}/reativar`)
      .set("Authorization", `Bearer ${token}`);
    expect(reativarRes.status).toBe(200);
    expect(reativarRes.body.data.ativo).toBe(true);

    const listaFinalRes = await request(app).get("/api/v1/turmas").set("Authorization", `Bearer ${token}`);
    expect(listaFinalRes.body.data).toHaveLength(1);
  });

  test("formador não pode criar, editar, apagar nem reativar turmas (403)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { token: tokenFormador } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${tokenFormador}`)
      .send({ codigo: "T-INTRUSO", designacao: "Turma", dataInicio: "2026-09-01" });
    expect(criarRes.status).toBe(403);

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ codigo: "T-PERM-1", designacao: "Turma Permissões", dataInicio: "2026-09-01" });
    const turmaId = turmaRes.body.data.id;

    const editarRes = await request(app)
      .patch(`/api/v1/turmas/${turmaId}`)
      .set("Authorization", `Bearer ${tokenFormador}`)
      .send({ designacao: "Alterada" });
    expect(editarRes.status).toBe(403);

    const apagarRes = await request(app)
      .delete(`/api/v1/turmas/${turmaId}`)
      .set("Authorization", `Bearer ${tokenFormador}`);
    expect(apagarRes.status).toBe(403);

    await request(app).delete(`/api/v1/turmas/${turmaId}`).set("Authorization", `Bearer ${tokenCoordenador}`);

    const reativarRes = await request(app)
      .patch(`/api/v1/turmas/${turmaId}/reativar`)
      .set("Authorization", `Bearer ${tokenFormador}`);
    expect(reativarRes.status).toBe(403);
  });

  test("criar turma com o código de uma turma inativa reativa-a em vez de duplicar (código é único na BD)", async () => {
    const { token } = await criarUtilizadorAutenticado(app);

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-DUP-2", designacao: "Nome Antigo", dataInicio: "2026-09-01" });
    const turmaId = criarRes.body.data.id;

    await request(app).delete(`/api/v1/turmas/${turmaId}`).set("Authorization", `Bearer ${token}`);

    const recriarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-DUP-2", designacao: "Nome Novo", dataInicio: "2026-10-01" });

    expect(recriarRes.status).toBe(201);
    expect(recriarRes.body.data.id).toBe(turmaId);
    expect(recriarRes.body.data.designacao).toBe("Nome Novo");
  });

  test("criar uma turma já com mediador envia-lhe uma notificação por email", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formador } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-MED-1", designacao: "Turma com Mediador", dataInicio: "2026-09-01", mediadorId: formador.id });

    expect(criarRes.status).toBe(201);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].tipo).toBe("MEDIADOR_ATRIBUIDO");
    expect(testOutbox[0].to).toBe(formador.email);
    expect(testOutbox[0].turmaCodigo).toBe("T-MED-1");
  });

  test("criar uma turma sem mediador não envia notificação", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-SEM-MED", designacao: "Turma sem Mediador", dataInicio: "2026-09-01" });

    expect(criarRes.status).toBe(201);
    expect(testOutbox).toHaveLength(0);
  });

  test("atribuir mediador a uma turma que ainda não tinha envia notificação, e voltar a gravar o mesmo mediador não repete o envio", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formador } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-MED-2", designacao: "Turma", dataInicio: "2026-09-01" });
    const turmaId = criarRes.body.data.id;
    limparTestOutbox();

    const atualizarRes = await request(app)
      .patch(`/api/v1/turmas/${turmaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ mediadorId: formador.id });
    expect(atualizarRes.status).toBe(200);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].to).toBe(formador.email);

    limparTestOutbox();

    const atualizarNovoRes = await request(app)
      .patch(`/api/v1/turmas/${turmaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ mediadorId: formador.id, designacao: "Turma (renomeada)" });
    expect(atualizarNovoRes.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });

  test("o mediador de uma turma pode ser removido enviando mediadorId: null", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ codigo: "T-MED-NULL", designacao: "Turma Mediador", dataInicio: "2026-09-01", mediadorId: formador.user.id });
    expect(criarRes.body.data.mediadorId).toBe(formador.user.id);

    const limparRes = await request(app)
      .patch(`/api/v1/turmas/${criarRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ mediadorId: null });

    expect(limparRes.status).toBe(200);
    expect(limparRes.body.data.mediadorId).toBeNull();
  });
});

describe("Vista do mediador (GET /turmas/mediacao)", () => {
  test("o mediador vê só as turmas que medeia, com UCs, horas e assiduidade dos formandos", async () => {
    const { coordenador, formador, formando, turma, turmaUc } = await prepararCenarioAcademico(app, { comAula: true });

    // ainda não é mediador de nada
    const antes = await request(app).get("/api/v1/turmas/mediacao").set(comToken(formador));
    expect(antes.status).toBe(200);
    expect(antes.body.data).toHaveLength(0);

    await request(app).patch(`/api/v1/turmas/${turma.id}`).set(comToken(coordenador)).send({ mediadorId: formador.user.id });
    const aula = (await prisma.aula.findFirst()).id;
    await request(app).put(`/api/v1/assiduidade/aula/${aula}`).set(comToken(formador)).send({ presencas: [{ formandoId: formando.user.id, estado: "AUSENTE" }] });

    const res = await request(app).get("/api/v1/turmas/mediacao").set(comToken(formador));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const m = res.body.data[0];
    expect(m.turma.codigo).toBe("T-ACAD");
    expect(m.ucs[0]).toMatchObject({ abreviatura: "UC-ACAD", cargaHoraria: 50, horasDadas: 1, horasEmFalta: 49 });
    expect(m.formandos[0]).toMatchObject({ nome: formando.user.nome, faltas: 1, faltasInjustificadas: 1 });
    expect(turmaUc.id).toBeTruthy();

    // outro formador (não mediador) não vê nada
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    expect((await request(app).get("/api/v1/turmas/mediacao").set(comToken(outro))).body.data).toHaveLength(0);
  });

  test("só formadores (403 à coordenação e aos formandos)", async () => {
    const { coordenador, formando } = await prepararCenarioAcademico(app);
    expect((await request(app).get("/api/v1/turmas/mediacao").set(comToken(coordenador))).status).toBe(403);
    expect((await request(app).get("/api/v1/turmas/mediacao").set(comToken(formando))).status).toBe(403);
  });
});
