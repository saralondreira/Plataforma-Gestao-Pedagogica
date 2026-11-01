const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

describe("POST /api/v1/pedidos-acesso", () => {
  test("não exige autenticação (formulário público)", async () => {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Pedro Candidato",
      email: "pedro@teste.pt",
      cargo: "formador",
      motivo: "Módulo de Programação Web",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe("PENDENTE");
  });

  test("rejeita sem nome/email/cargo", async () => {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({ motivo: "x" });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/v1/pedidos-acesso", () => {
  test("exige autenticação", async () => {
    const res = await request(app).get("/api/v1/pedidos-acesso");
    expect(res.status).toBe(401);
  });

  test("recusa formador (só coordenação pode listar)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const res = await request(app).get("/api/v1/pedidos-acesso").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("lista pedidos para a coordenação", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Ana Candidata",
      email: "ana.candidata@teste.pt",
      cargo: "formando",
    });

    const res = await request(app).get("/api/v1/pedidos-acesso").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].estado).toBe("PENDENTE");
  });
});

// Fluxo via RH (2026-09-10): aprovar já não cria a conta na hora — só
// decide o papel/turma e o pedido fica "A_AGUARDAR_RH". A conta só é criada
// mesmo no passo seguinte, PATCH /:id/confirmar-conta-criada (ver describe
// mais abaixo). Ver PLANEAMENTO.md, "Pedidos de Acesso via RH".
describe("PATCH /api/v1/pedidos-acesso/:id/aprovar", () => {
  async function criarPedidoPendente(email = "candidata@teste.pt") {
    const res = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Candidata Teste",
      email,
      cargo: "formador",
    });
    return res.body.data.id;
  }

  test("aprova o pedido, fica a aguardar RH e ainda NÃO cria a conta", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoPendente("nova.formadora@teste.pt");

    const aprovarRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });

    expect(aprovarRes.status).toBe(200);
    expect(aprovarRes.body.data.estado).toBe("A_AGUARDAR_RH");
    expect(aprovarRes.body.data.roleDecidido).toBe("FORMADOR");

    // Nenhum email chegou a ser enviado, e a conta ainda não existe.
    expect(testOutbox).toHaveLength(0);
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nova.formadora@teste.pt", password: "qualquercoisa" });
    expect(loginRes.status).toBe(401);
  });

  test("aprova com o papel FORMANDO", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoPendente("novo.formando@teste.pt");

    const aprovarRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMANDO" });

    expect(aprovarRes.status).toBe(200);
    expect(aprovarRes.body.data.roleDecidido).toBe("FORMANDO");
  });

  test("aprova FORMANDO com turmaId — fica registado no pedido, ainda não no utilizador", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-FORMANDO-1", designacao: "Turma do Formando", dataInicio: "2026-09-01" });
    const turmaId = turmaRes.body.data.id;

    const idPedido = await criarPedidoPendente("formando.com.turma@teste.pt");

    const aprovarRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMANDO", turmaId });

    expect(aprovarRes.status).toBe(200);
    expect(aprovarRes.body.data.turmaIdDecidido).toBe(turmaId);
    expect(aprovarRes.body.data.turmaDecidida.codigo).toBe("T-FORMANDO-1");
  });

  test("recusa turmaId de uma turma inexistente", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoPendente("formando.turma.invalida@teste.pt");

    const aprovarRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMANDO", turmaId: 999999 });

    expect(aprovarRes.status).toBe(404);
    expect(aprovarRes.body.error.code).toBe("TURMA_NOT_FOUND");
  });

  test("recusa formador (só coordenação pode aprovar)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const idPedido = await criarPedidoPendente();

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });

    expect(res.status).toBe(403);
  });

  test("não deixa aprovar duas vezes o mesmo pedido", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoPendente();

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });

    const segundaRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });

    expect(segundaRes.status).toBe(409);
  });

  test("404 para pedido inexistente", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/pedidos-acesso/999999/aprovar")
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PEDIDO_NOT_FOUND");
  });
});

describe("PATCH /api/v1/pedidos-acesso/:id/confirmar-conta-criada", () => {
  async function criarPedidoAAguardarRh(token, { email = "candidata@teste.pt", role = "FORMADOR", turmaId } = {}) {
    const criarRes = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Candidata Teste",
      email,
      cargo: "formador",
    });
    const idPedido = criarRes.body.data.id;

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send(turmaId ? { role, turmaId } : { role });

    return idPedido;
  }

  test("cria a conta real e envia as credenciais por email — nunca na resposta da API (ciclo completo)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoAAguardarRh(token, { email: "nova.formadora@teste.pt", role: "FORMADOR" });

    const confirmarRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    expect(confirmarRes.status).toBe(200);
    expect(confirmarRes.body.data.pedido.estado).toBe("APROVADO");
    expect(confirmarRes.body.data.emailEnviado).toBe(true);
    // Regressão de segurança: a Fase 8b deixou de devolver a password na resposta.
    expect(confirmarRes.body.data.credenciais).toBeUndefined();
    expect(JSON.stringify(confirmarRes.body)).not.toMatch(/password/i);

    // A password só existe agora no "email" enviado (capturado em memória nos testes).
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].to).toBe("nova.formadora@teste.pt");
    const passwordTemporaria = testOutbox[0].passwordTemporaria;
    expect(passwordTemporaria).toEqual(expect.any(String));

    // A conta tem mesmo de existir e funcionar para login com a password enviada por email.
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "nova.formadora@teste.pt",
      password: passwordTemporaria,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.role).toBe("FORMADOR");
  });

  test("aprova com o papel FORMANDO", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoAAguardarRh(token, { email: "novo.formando@teste.pt", role: "FORMANDO" });

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    expect(testOutbox[0].role).toBe("FORMANDO");

    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "novo.formando@teste.pt",
      password: testOutbox[0].passwordTemporaria,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.role).toBe("FORMANDO");
  });

  test("aprova FORMANDO com turmaId e associa a conta à turma", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-FORMANDO-2", designacao: "Turma do Formando", dataInicio: "2026-09-01" });
    const turmaId = turmaRes.body.data.id;

    const idPedido = await criarPedidoAAguardarRh(token, {
      email: "formando.com.turma@teste.pt",
      role: "FORMANDO",
      turmaId,
    });

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "formando.com.turma@teste.pt",
      password: testOutbox[0].passwordTemporaria,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.turmaId).toBe(turmaId);
  });

  test("recusa confirmar um pedido que ainda está só PENDENTE (não foi aprovado)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const criarRes = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Candidata Teste",
      email: "ainda.pendente@teste.pt",
      cargo: "formador",
    });

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${criarRes.body.data.id}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PEDIDO_NAO_AGUARDA_RH");
  });

  test("recusa confirmar duas vezes o mesmo pedido", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const idPedido = await criarPedidoAAguardarRh(token, { email: "duplo.confirmar@teste.pt" });

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    const segundaRes = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    expect(segundaRes.status).toBe(409);
    expect(segundaRes.body.error.code).toBe("PEDIDO_NAO_AGUARDA_RH");
  });

  test("recusa confirmar se a turma associada foi desativada entretanto", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const turmaRes = await request(app)
      .post("/api/v1/turmas")
      .set("Authorization", `Bearer ${token}`)
      .send({ codigo: "T-DESATIVA-DEPOIS", designacao: "Turma", dataInicio: "2026-09-01" });
    const turmaId = turmaRes.body.data.id;

    const idPedido = await criarPedidoAAguardarRh(token, {
      email: "turma.desativada@teste.pt",
      role: "FORMANDO",
      turmaId,
    });

    await request(app).delete(`/api/v1/turmas/${turmaId}`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("TURMA_INATIVA");
  });

  test("recusa formador (só coordenação pode confirmar)", async () => {
    const { token: tokenCoordenador } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { token: tokenFormador } = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const idPedido = await criarPedidoAAguardarRh(tokenCoordenador, { email: "so.coordenacao@teste.pt" });

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${tokenFormador}`);

    expect(res.status).toBe(403);
  });

  test("404 para pedido inexistente", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .patch("/api/v1/pedidos-acesso/999999/confirmar-conta-criada")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PEDIDO_NOT_FOUND");
  });
});

describe("PATCH /api/v1/pedidos-acesso/:id/rejeitar", () => {
  test("marca o pedido como rejeitado e não cria conta (a partir de PENDENTE)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const criarRes = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Rejeitado Teste",
      email: "rejeitado@teste.pt",
      cargo: "formador",
    });
    const idPedido = criarRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/rejeitar`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("REJEITADO");

    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: "rejeitado@teste.pt",
      password: "qualquercoisa",
    });
    expect(loginRes.status).toBe(401);
  });

  test("também é possível rejeitar um pedido que já estava a aguardar RH (ex.: RH acaba por não avançar)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const criarRes = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "A Aguardar RH",
      email: "aguardava.rh@teste.pt",
      cargo: "formador",
    });
    const idPedido = criarRes.body.data.id;

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/rejeitar`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe("REJEITADO");
  });

  test("não deixa rejeitar um pedido cuja conta já foi criada", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const criarRes = await request(app).post("/api/v1/pedidos-acesso").send({
      nome: "Já Aprovado",
      email: "ja.aprovado@teste.pt",
      cargo: "formador",
    });
    const idPedido = criarRes.body.data.id;

    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/aprovar`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "FORMADOR" });
    await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/confirmar-conta-criada`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/v1/pedidos-acesso/${idPedido}/rejeitar`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PEDIDO_JA_TRATADO");
  });
});
