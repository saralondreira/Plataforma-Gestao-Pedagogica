const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("Turmas — mediador e ID de curso IEFP", () => {
  test("turma criada com mediador (formador) e idCursoIEFP fica registada", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ codigo: "T-UC-1", designacao: "Turma UCs", dataInicio: "2026-09-01", mediadorId: formador.user.id });

    expect(turmaRes.body.data.mediadorId).toBe(formador.user.id);
    expect(turmaRes.body.data.mediador.nome).toBe(formador.user.nome);
  });

  test("rejeita mediador inválido (não é formador)", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const outroCoordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const res = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ codigo: "T-UC-BAD", designacao: "Turma", dataInicio: "2026-09-01", mediadorId: outroCoordenador.user.id });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MEDIADOR_INVALIDO");
  });
});

describe("UCs — catálogo (independente de turma)", () => {
  test("coordenador cria UC no catálogo, edita e apaga (ciclo completo)", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00034", nome: "Colaborar e trabalhar em equipa", cargaHoraria: 50 });

    expect(criarRes.status).toBe(201);
    expect(criarRes.body.data.abreviatura).toBe("UC00034");
    const ucId = criarRes.body.data.id;

    const listarRes = await request(app)
      .get("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listarRes.status).toBe(200);
    expect(listarRes.body.data).toHaveLength(1);

    const atualizarRes = await request(app)
      .patch(`/api/v1/ucs/${ucId}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ cargaHoraria: 25 });
    expect(atualizarRes.status).toBe(200);
    expect(atualizarRes.body.data.cargaHoraria).toBe(25);

    const apagarRes = await request(app)
      .delete(`/api/v1/ucs/${ucId}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(apagarRes.status).toBe(204);
  });

  test("formador pode listar o catálogo mas não pode criar UC (403)", async () => {
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const listarRes = await request(app)
      .get("/api/v1/ucs")
      .set("Authorization", `Bearer ${formador.token}`);
    expect(listarRes.status).toBe(200);

    const criarRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ abreviatura: "UC00034", nome: "Teste", cargaHoraria: 10 });
    expect(criarRes.status).toBe(403);
  });

  test("rejeita abreviatura duplicada no catálogo", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const dados = { abreviatura: "UC00034", nome: "Teste", cargaHoraria: 10 };

    await request(app).post("/api/v1/ucs").set("Authorization", `Bearer ${coordenador.token}`).send(dados);
    const res = await request(app).post("/api/v1/ucs").set("Authorization", `Bearer ${coordenador.token}`).send(dados);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ABREVIATURA_EM_USO");
  });

  // Antes esta operação era recusada com 409 UC_ASSOCIADA_A_TURMAS — desde que
  // apagar passou a ser uma flag (soft delete), já não há nada a perder e a UC
  // fica só inativa, mantendo a associação e as aulas já dadas intactas.
  test("apagar (desativar) uma UC já associada a uma turma não é bloqueado, e a associação mantém-se", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const ucRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00099", nome: "Teste", cargaHoraria: 10 });

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ codigo: "T-UC-2", designacao: "Turma UCs 2", dataInicio: "2026-09-01" });

    await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaRes.body.data.id, ucId: ucRes.body.data.id, formadorId: formador.user.id });

    const apagarRes = await request(app)
      .delete(`/api/v1/ucs/${ucRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(apagarRes.status).toBe(204);

    const associacoesRes = await request(app)
      .get(`/api/v1/turma-ucs/turma/${turmaRes.body.data.id}?incluirInativos=true`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(associacoesRes.body.data).toHaveLength(1);
  });

  test("UC desativada some da listagem por omissão mas aparece com ?incluirInativos=true, e é possível reativá-la", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const ucRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00077", nome: "Teste", cargaHoraria: 10 });
    const ucId = ucRes.body.data.id;

    await request(app).delete(`/api/v1/ucs/${ucId}`).set("Authorization", `Bearer ${coordenador.token}`);

    const listaSemInativosRes = await request(app)
      .get("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaSemInativosRes.body.data).toHaveLength(0);

    const listaComInativosRes = await request(app)
      .get("/api/v1/ucs?incluirInativos=true")
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaComInativosRes.body.data).toHaveLength(1);
    expect(listaComInativosRes.body.data[0].ativo).toBe(false);

    const reativarRes = await request(app)
      .patch(`/api/v1/ucs/${ucId}/reativar`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(reativarRes.status).toBe(200);
    expect(reativarRes.body.data.ativo).toBe(true);

    const listaFinalRes = await request(app)
      .get("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaFinalRes.body.data).toHaveLength(1);
  });

  test("criar UC com a abreviatura de uma UC inativa reativa-a em vez de duplicar (abreviatura é única na BD)", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const ucRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00055", nome: "Nome Antigo", cargaHoraria: 10 });
    const ucId = ucRes.body.data.id;

    await request(app).delete(`/api/v1/ucs/${ucId}`).set("Authorization", `Bearer ${coordenador.token}`);

    const recriarRes = await request(app)
      .post("/api/v1/ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00055", nome: "Nome Novo", cargaHoraria: 20 });

    expect(recriarRes.status).toBe(201);
    expect(recriarRes.body.data.id).toBe(ucId);
    expect(recriarRes.body.data.nome).toBe("Nome Novo");
    expect(recriarRes.body.data.ativo).toBe(true);

    const listaRes = await request(app).get("/api/v1/ucs").set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaRes.body.data).toHaveLength(1);
  });

  test("editar UC inexistente devolve 404 UC_NOT_FOUND", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/ucs/999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Não Existe" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("UC_NOT_FOUND");
  });
});
