const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

// Correções da revisão de código (2026-10-27): leitura por turma/UC, sessões
// invalidadas ao mudar a palavra-passe, validações de entrada.

describe("Leitura de aulas e UCs só por quem pertence à turma/UC", () => {
  async function outraTurma(coordenador) {
    const res = await request(app)
      .post("/api/v1/turmas").set(comToken(coordenador))
      .send({ codigo: "T-OUTRA", designacao: "Outra Turma", dataInicio: "2026-09-01" });
    return res.body.data;
  }

  test("formando da turma lê as aulas e as UCs; formando de outra turma recebe 403", async () => {
    const c = await prepararCenarioAcademico(app);
    const outra = await outraTurma(c.coordenador);
    const intruso = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outra.id });

    expect((await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(comToken(c.formando))).status).toBe(200);
    expect((await request(app).get(`/api/v1/turma-ucs/turma/${c.turma.id}`).set(comToken(c.formando))).status).toBe(200);

    expect((await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(comToken(intruso))).status).toBe(403);
    expect((await request(app).get(`/api/v1/turma-ucs/turma/${c.turma.id}`).set(comToken(intruso))).status).toBe(403);
  });

  test("formador responsável e coordenação leem; formador sem ligação à turma recebe 403", async () => {
    const c = await prepararCenarioAcademico(app);
    const estranho = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    for (const quem of [c.formador, c.coordenador]) {
      expect((await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(comToken(quem))).status).toBe(200);
      expect((await request(app).get(`/api/v1/turma-ucs/turma/${c.turma.id}`).set(comToken(quem))).status).toBe(200);
    }
    expect((await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(comToken(estranho))).status).toBe(403);
    expect((await request(app).get(`/api/v1/turma-ucs/turma/${c.turma.id}`).set(comToken(estranho))).status).toBe(403);
  });

  test("o mediador da turma também pode ler", async () => {
    const c = await prepararCenarioAcademico(app);
    const mediador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    await request(app).patch(`/api/v1/turmas/${c.turma.id}`).set(comToken(c.coordenador)).send({ mediadorId: mediador.user.id });

    expect((await request(app).get(`/api/v1/turma-ucs/turma/${c.turma.id}`).set(comToken(mediador))).status).toBe(200);
    expect((await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(comToken(mediador))).status).toBe(200);
  });

  test("UC inexistente devolve 404", async () => {
    const c = await prepararCenarioAcademico(app);
    expect((await request(app).get("/api/v1/aulas/turma-uc/999999").set(comToken(c.coordenador))).status).toBe(404);
  });
});

describe("Sessões e palavra-passe", () => {
  test("depois de redefinir a palavra-passe, o token antigo deixa de funcionar", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMADOR", email: "sessao@teste.pt", password: "Antiga123!" });
    expect((await request(app).get("/api/v1/auth/me").set(comToken(u))).status).toBe(200);

    await request(app).post("/api/v1/auth/esqueci-password").send({ email: u.user.email });
    const email = testOutbox.find((e) => e.tipo === "RECUPERAR_PASSWORD");
    const token = email.texto.match(/token=([\w.-]+)/)[1];
    expect((await request(app).post("/api/v1/auth/redefinir-password").send({ token, password: "Nova12345!" })).status).toBe(200);

    const antigo = await request(app).get("/api/v1/auth/me").set(comToken(u));
    expect(antigo.status).toBe(401);
    expect(antigo.body.error.code).toBe("SESSAO_INVALIDA");

    const novo = await request(app).post("/api/v1/auth/login").send({ email: u.user.email, password: "Nova12345!" });
    expect(novo.status).toBe(200);
    expect((await request(app).get("/api/v1/auth/me").set({ Authorization: `Bearer ${novo.body.data.token}` })).status).toBe(200);
  });

  test("um token sem a impressão da palavra-passe é recusado", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const semImpressao = jwt.sign({ id: u.user.id, role: "FORMADOR" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    expect((await request(app).get("/api/v1/auth/me").set({ Authorization: `Bearer ${semImpressao}` })).status).toBe(401);
  });
});

describe("Validações de entrada", () => {
  test("token de calendário com id que não é um inteiro dá 404 (e não um erro 500)", async () => {
    const falso = jwt.sign({ id: "abc", tipo: "calendario" }, "qualquer-segredo");
    const res = await request(app).get("/api/v1/calendario/feed.ics").query({ t: falso });
    expect(res.status).toBe(404);
  });

  test("nota: null, texto vazio e booleanos são recusados (já não viram 0 ou 1)", async () => {
    const c = await prepararCenarioAcademico(app);
    const lancar = (valor) =>
      request(app).put(`/api/v1/notas/turma-uc/${c.turmaUc.id}/formando/${c.formando.user.id}`).set(comToken(c.formador)).send({ valor });

    for (const invalido of [null, "", true, false]) {
      expect((await lancar(invalido)).status).toBe(422);
    }
    expect((await lancar(15)).status).toBe(200);
    expect((await lancar("17.5")).status).toBe(200);
  });

  test("reagendar uma aula para um bloco de um dia que já passou é recusado", async () => {
    const c = await prepararCenarioAcademico(app);
    const bloco = (data, hora) =>
      request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data, horaInicio: hora, estado: "LIVRE" });
    const futuro = await bloco("2030-03-04", 9);
    const passado = await bloco("2026-09-10", 9);
    const aula = await request(app)
      .post("/api/v1/aulas").set(comToken(c.coordenador))
      .send({ turmaUcId: c.turmaUc.id, disponibilidadeId: futuro.body.data.id, modalidade: "ONLINE" });
    expect(aula.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/aulas/${aula.body.data.id}/reagendar`).set(comToken(c.coordenador))
      .send({ disponibilidadeId: passado.body.data.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DATA_PASSADA");
  });
});

describe("Emails em produção", () => {
  test("sem SMTP_HOST, em produção, o transporte falha em vez de usar o serviço de teste", async () => {
    const antes = { env: process.env.NODE_ENV, host: process.env.SMTP_HOST };
    process.env.NODE_ENV = "production";
    delete process.env.SMTP_HOST;
    try {
      let getTransporter;
      jest.isolateModules(() => {
        ({ getTransporter } = require("../../src/lib/mailer"));
      });
      expect(typeof getTransporter).toBe("function");
      await expect(getTransporter()).rejects.toThrow(/SMTP_HOST/);
    } finally {
      process.env.NODE_ENV = antes.env;
      if (antes.host !== undefined) process.env.SMTP_HOST = antes.host;
    }
  });
});

// Segunda passagem (2026-10-27): descarregar documentos, responder a mensagens,
// limites da escala de notas, sumários do formador e palavras-passe longas.

describe("Descarregar documentos — permissões no ficheiro", () => {
  async function comDocumento() {
    const c = await prepararCenarioAcademico(app);
    const envio = await request(app)
      .post(`/api/v1/documentos/turma-uc/${c.turmaUc.id}`).set(comToken(c.formador))
      .attach("ficheiro", Buffer.from("conteudo"), "plano.txt");
    expect(envio.status).toBe(201);
    return { ...c, docId: envio.body.data.id };
  }

  test("formando da turma descarrega; formando de outra turma, outro formador e pedido sem token não", async () => {
    const c = await comDocumento();
    const outra = (await request(app).post("/api/v1/turmas").set(comToken(c.coordenador)).send({ codigo: "T-OUTRA", designacao: "Outra", dataInicio: "2026-09-01" })).body.data;
    const intruso = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outra.id });
    const estranho = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const url = `/api/v1/documentos/${c.docId}/ficheiro`;

    expect((await request(app).get(url).set(comToken(c.formando))).status).toBe(200);
    expect((await request(app).get(url).set(comToken(intruso))).status).toBe(403);
    expect((await request(app).get(url).set(comToken(estranho))).status).toBe(403);
    expect((await request(app).get(url)).status).toBe(401);
  });
});

describe("Mensagens — só o destinatário responde", () => {
  test("um formador que não é o destinatário não consegue responder", async () => {
    const c = await prepararCenarioAcademico(app);
    const envio = await request(app).post("/api/v1/mensagens").set(comToken(c.formando)).send({ destino: "COORDENACAO", assunto: "Dúvida", corpo: "Texto da dúvida" });
    expect(envio.status).toBe(201);
    const id = envio.body.data.id;

    const intruso = await request(app).patch(`/api/v1/mensagens/${id}/responder`).set(comToken(c.formador)).send({ resposta: "Não devia poder" });
    expect([403, 404]).toContain(intruso.status);
    const remetente = await request(app).patch(`/api/v1/mensagens/${id}/responder`).set(comToken(c.formando)).send({ resposta: "Eu próprio" });
    expect([403, 404]).toContain(remetente.status);

    const enviadas = await request(app).get("/api/v1/mensagens/enviadas").set(comToken(c.formando));
    expect(enviadas.body.data[0].resposta).toBeNull();
  });
});

describe("Notas — os extremos da escala são válidos", () => {
  test("0 e 20 são aceites", async () => {
    const c = await prepararCenarioAcademico(app);
    const lancar = (valor) => request(app).put(`/api/v1/notas/turma-uc/${c.turmaUc.id}/formando/${c.formando.user.id}`).set(comToken(c.formador)).send({ valor });
    expect((await lancar(0)).status).toBe(200);
    expect((await lancar(20)).status).toBe(200);
    expect((await lancar(20.01)).status).toBe(422);
  });
});

describe("Sumários — os do formador", () => {
  test("o formador lê os seus sumários; o formando não tem acesso", async () => {
    const c = await prepararCenarioAcademico(app);
    expect((await request(app).get("/api/v1/sumarios/meus").set(comToken(c.formador))).status).toBe(200);
    expect((await request(app).get("/api/v1/sumarios/meus").set(comToken(c.formando))).status).toBe(403);
  });
});

describe("Palavra-passe — limite do bcrypt", () => {
  test("mais de 72 bytes é recusado ao redefinir; 72 bytes é aceite", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMADOR", email: "longa@teste.pt", password: "Antiga123!" });
    await request(app).post("/api/v1/auth/esqueci-password").send({ email: u.user.email });
    const token = testOutbox.find((e) => e.tipo === "RECUPERAR_PASSWORD").texto.match(/token=([\w.-]+)/)[1];

    const longa = "a".repeat(73);
    expect((await request(app).post("/api/v1/auth/redefinir-password").send({ token, password: longa })).status).toBe(422);
    expect((await request(app).post("/api/v1/auth/redefinir-password").send({ token, password: "a".repeat(72) })).status).toBe(200);
  });
});

describe("Pedidos de acesso — formador criado pelo fluxo dos RH", () => {
  test("a conta de formador criada ao confirmar fica com o estado ATIVO (e não nulo)", async () => {
    const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const pedido = await request(app).post("/api/v1/pedidos-acesso").send({ nome: "Nova Formadora", email: "nova.formadora@exemplo.pt", cargo: "formador", motivo: "Teste" });
    expect(pedido.status).toBe(201);
    const id = pedido.body.data.id;
    expect((await request(app).patch(`/api/v1/pedidos-acesso/${id}/aprovar`).set(comToken(coordenador)).send({ role: "FORMADOR" })).status).toBe(200);
    expect((await request(app).patch(`/api/v1/pedidos-acesso/${id}/confirmar-conta-criada`).set(comToken(coordenador))).status).toBe(200);

    const conta = await prisma.user.findUnique({ where: { email: "nova.formadora@exemplo.pt" } });
    expect(conta.role).toBe("FORMADOR");
    expect(conta.estadoFormador).toBe("ATIVO");
  });
});
