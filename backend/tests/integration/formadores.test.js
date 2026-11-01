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

describe("Formadores", () => {
  test("criar formador cria uma conta de login real, listagem só mostra role=FORMADOR", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${token}`)
      .send({
        nome: "Ana Formadora",
        email: "ana.formadora@teste.pt",
        password: "Teste123!",
        sigla: "AF",
        turmasQtd: 2,
        ucsQtd: 3,
      });

    expect(criarRes.status).toBe(201);
    expect(criarRes.body.data.passwordHash).toBeUndefined();

    const loginFormadorRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ana.formadora@teste.pt", password: "Teste123!" });
    expect(loginFormadorRes.status).toBe(200);
    expect(loginFormadorRes.body.data.user.role).toBe("FORMADOR");

    const listarRes = await request(app).get("/api/v1/formadores").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(1);
  });

  test("coordenador não aparece na lista de formadores", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const listarRes = await request(app).get("/api/v1/formadores").set("Authorization", `Bearer ${token}`);
    expect(listarRes.body.data).toHaveLength(0);
  });

  // Antes "apagar" fazia DELETE definitivo — se o formador já tivesse
  // entregas, UCs lecionadas ou disponibilidades, a base de dados recusava o
  // delete (chave estrangeira) e o pedido falhava. Agora fica só inativo:
  // deixa de poder fazer login e de aparecer nas listagens, mas o histórico
  // mantém-se.
  test("apagar (desativar) um formador impede-o de fazer login e tira-o da listagem, mas mantém o histórico", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ nome: "Bruno Formador", email: "bruno.formador@teste.pt", password: "Teste123!" });
    const formadorId = criarRes.body.data.id;

    const apagarRes = await request(app)
      .delete(`/api/v1/formadores/${formadorId}`)
      .set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(apagarRes.status).toBe(204);

    const listarRes = await request(app).get("/api/v1/formadores").set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(listarRes.body.data).toHaveLength(0);

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bruno.formador@teste.pt", password: "Teste123!" });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe("CONTA_INATIVA");

    const listaComInativosRes = await request(app)
      .get("/api/v1/formadores?incluirInativos=true")
      .set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(listaComInativosRes.body.data).toHaveLength(1);

    const reativarRes = await request(app)
      .patch(`/api/v1/formadores/${formadorId}/reativar`)
      .set("Authorization", `Bearer ${tokenCoordenador}`);
    expect(reativarRes.status).toBe(200);

    const loginDepoisRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bruno.formador@teste.pt", password: "Teste123!" });
    expect(loginDepoisRes.status).toBe(200);
  });

  test("um token emitido antes de o formador ser desativado deixa de dar acesso (requireAuth valida ativo na BD)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    // O formador tem um token válido, emitido antes da desativação.
    const meAntesRes = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${formador.token}`);
    expect(meAntesRes.status).toBe(200);

    await request(app)
      .delete(`/api/v1/formadores/${formador.user.id}`)
      .set("Authorization", `Bearer ${tokenCoordenador}`);

    const meDepoisRes = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${formador.token}`);
    expect(meDepoisRes.status).toBe(403);
    expect(meDepoisRes.body.error.code).toBe("CONTA_INATIVA");
  });

  test("formador não pode criar, editar, apagar nem reativar formadores (403)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const criarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ nome: "Intruso", email: "intruso@teste.pt", password: "Teste123!" });
    expect(criarRes.status).toBe(403);

    const editarRes = await request(app)
      .patch(`/api/v1/formadores/${formador.user.id}`)
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ nome: "Alterado" });
    expect(editarRes.status).toBe(403);

    const apagarRes = await request(app)
      .delete(`/api/v1/formadores/${formador.user.id}`)
      .set("Authorization", `Bearer ${formador.token}`);
    expect(apagarRes.status).toBe(403);

    await request(app)
      .delete(`/api/v1/formadores/${formador.user.id}`)
      .set("Authorization", `Bearer ${tokenCoordenador}`);

    // Usa um segundo formador (ainda ativo) para testar especificamente a
    // barreira de papel no reativar — o primeiro já ficou inativo acima, e
    // um token de conta inativa seria sempre recusado, independentemente do
    // papel, o que não testaria a coisa certa.
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const reativarRes = await request(app)
      .patch(`/api/v1/formadores/${formador.user.id}/reativar`)
      .set("Authorization", `Bearer ${outroFormador.token}`);
    expect(reativarRes.status).toBe(403);
  });

  test("criar formador com o email de um formador inativo reativa a conta antiga em vez de duplicar (email é único na BD)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const criarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ nome: "Carla Antiga", email: "carla@teste.pt", password: "Teste123!" });
    const formadorId = criarRes.body.data.id;

    await request(app).delete(`/api/v1/formadores/${formadorId}`).set("Authorization", `Bearer ${tokenCoordenador}`);

    const recriarRes = await request(app)
      .post("/api/v1/formadores")
      .set("Authorization", `Bearer ${tokenCoordenador}`)
      .send({ nome: "Carla Nova", email: "carla@teste.pt", password: "NovaPass123!" });

    expect(recriarRes.status).toBe(201);
    expect(recriarRes.body.data.id).toBe(formadorId);
    expect(recriarRes.body.data.nome).toBe("Carla Nova");

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "carla@teste.pt", password: "NovaPass123!" });
    expect(loginRes.status).toBe(200);
  });

  test("editar formador inexistente devolve 404 FORMADOR_NOT_FOUND", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/formadores/999999")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Não Existe" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("FORMADOR_NOT_FOUND");
  });
});
