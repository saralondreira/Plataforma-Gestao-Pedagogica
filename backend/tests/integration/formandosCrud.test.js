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

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function criarTurma(token, overrides = {}) {
  const res = await request(app)
    .post("/api/v1/turmas")
    .set(auth(token))
    .send({ codigo: "T-2026-X", designacao: "Turma Teste", dataInicio: "2026-09-01", ...overrides });
  return res.body.data;
}

const login = (email, password) => request(app).post("/api/v1/auth/login").send({ email, password });

describe("Formandos: criar, editar, desativar e reativar", () => {
  test("a coordenação cria um formando (com turma) e ele consegue fazer login", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const turma = await criarTurma(token);

    const res = await request(app)
      .post("/api/v1/formandos")
      .set(auth(token))
      .send({ nome: "Rui Teste", email: "rui@teste.pt", password: "Segredo123!", turmaId: turma.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ nome: "Rui Teste", email: "rui@teste.pt", role: "FORMANDO", ativo: true });
    expect(res.body.data.turma.id).toBe(turma.id);
    expect(res.body.data.passwordHash).toBeUndefined();

    const entrada = await login("rui@teste.pt", "Segredo123!");
    expect(entrada.status).toBe(200);
  });

  test("cria um formando sem turma", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app)
      .post("/api/v1/formandos")
      .set(auth(token))
      .send({ nome: "Sem Turma", email: "semturma@teste.pt", password: "Segredo123!" });
    expect(res.status).toBe(201);
    expect(res.body.data.turma).toBeNull();
  });

  test("email repetido devolve 409 EMAIL_IN_USE", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const corpo = { nome: "Rui Teste", email: "rui@teste.pt", password: "Segredo123!" };
    await request(app).post("/api/v1/formandos").set(auth(token)).send(corpo);

    const res = await request(app).post("/api/v1/formandos").set(auth(token)).send(corpo);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  test("palavra-passe curta, email inválido e turma inexistente ou inativa são recusados", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const base = { nome: "Rui Teste", email: "rui@teste.pt", password: "Segredo123!" };

    const curta = await request(app).post("/api/v1/formandos").set(auth(token)).send({ ...base, password: "curta" });
    expect(curta.status).toBe(422);

    const email = await request(app).post("/api/v1/formandos").set(auth(token)).send({ ...base, email: "sem-arroba" });
    expect(email.status).toBe(422);

    const inexistente = await request(app).post("/api/v1/formandos").set(auth(token)).send({ ...base, turmaId: 999999 });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("TURMA_NOT_FOUND");

    const turma = await criarTurma(token);
    await prisma.turma.update({ where: { id: turma.id }, data: { ativo: false } });
    const inativa = await request(app).post("/api/v1/formandos").set(auth(token)).send({ ...base, turmaId: turma.id });
    expect(inativa.status).toBe(422);
    expect(inativa.body.error.code).toBe("TURMA_INATIVA");
  });

  test("edita o nome, o email e a turma", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const turma = await criarTurma(token);

    const res = await request(app)
      .patch(`/api/v1/formandos/${formando.id}`)
      .set(auth(token))
      .send({ nome: "Nome Novo", email: "novo@teste.pt", turmaId: turma.id });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nome: "Nome Novo", email: "novo@teste.pt" });
    expect(res.body.data.turma.id).toBe(turma.id);

    const semTurma = await request(app).patch(`/api/v1/formandos/${formando.id}`).set(auth(token)).send({ turmaId: null });
    expect(semTurma.status).toBe(200);
    expect(semTurma.body.data.turma).toBeNull();
    expect(semTurma.body.data.nome).toBe("Nome Novo"); // o que não se envia não muda
  });

  test("editar com o email de outra conta devolve 409; sem campos devolve 422; formando inexistente devolve 404", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: a } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const { user: b } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    const repetido = await request(app).patch(`/api/v1/formandos/${a.id}`).set(auth(token)).send({ email: b.email });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("EMAIL_IN_USE");

    const vazio = await request(app).patch(`/api/v1/formandos/${a.id}`).set(auth(token)).send({});
    expect(vazio.status).toBe(422);

    const inexistente = await request(app).patch("/api/v1/formandos/999999").set(auth(token)).send({ nome: "Ninguém" });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("FORMANDO_NOT_FOUND");
  });

  test("desativar não apaga: o formando deixa de entrar e de aparecer, e reativar devolve-lhe o acesso", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO", password: "Teste123!" });

    const desativar = await request(app).delete(`/api/v1/formandos/${formando.id}`).set(auth(token));
    expect(desativar.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: formando.id } })).toMatchObject({ ativo: false });

    expect((await login(formando.email, "Teste123!")).status).not.toBe(200);
    const lista = await request(app).get("/api/v1/formandos").set(auth(token));
    expect(lista.body.data).toHaveLength(0);

    const reativar = await request(app).patch(`/api/v1/formandos/${formando.id}/reativar`).set(auth(token));
    expect(reativar.status).toBe(200);
    expect(reativar.body.data.ativo).toBe(true);
    expect((await login(formando.email, "Teste123!")).status).toBe(200);
  });

  test("criar com o email de um formando desativado reativa essa conta (mesmo id)", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user: formando } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    await request(app).delete(`/api/v1/formandos/${formando.id}`).set(auth(token));

    const res = await request(app)
      .post("/api/v1/formandos")
      .set(auth(token))
      .send({ nome: "Voltou", email: formando.email, password: "NovaPass123!" });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(formando.id);
    expect(res.body.data.ativo).toBe(true);
    expect((await login(formando.email, "NovaPass123!")).status).toBe(200);
  });

  test("desativar ou reativar um formando inexistente devolve 404", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    expect((await request(app).delete("/api/v1/formandos/999999").set(auth(token))).status).toBe(404);
    expect((await request(app).patch("/api/v1/formandos/999999/reativar").set(auth(token))).status).toBe(404);
  });

  test("a coordenação repõe a palavra-passe: a nova entra, a antiga e a sessão aberta deixam de valer", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const formando = await criarUtilizadorAutenticado(app, { role: "FORMANDO", password: "Antiga123!" });

    const res = await request(app)
      .patch(`/api/v1/formandos/${formando.user.id}/password`)
      .set(auth(token))
      .send({ password: "Nova12345!" });
    expect(res.status).toBe(204);

    expect((await login(formando.user.email, "Nova12345!")).status).toBe(200);
    expect((await login(formando.user.email, "Antiga123!")).status).not.toBe(200);
    const sessaoAntiga = await request(app).get("/api/v1/auth/me").set(auth(formando.token));
    expect(sessaoAntiga.status).toBe(401);
  });

  test("repor a palavra-passe recusa palavras-passe curtas e formandos inexistentes", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const { user } = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    const curta = await request(app).patch(`/api/v1/formandos/${user.id}/password`).set(auth(token)).send({ password: "curta" });
    expect(curta.status).toBe(422);
    const inexistente = await request(app).patch("/api/v1/formandos/999999/password").set(auth(token)).send({ password: "Nova12345!" });
    expect(inexistente.status).toBe(404);
  });

  test("só a coordenação pode criar, editar, desativar e reativar (403 para os outros papéis)", async () => {
    const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const formando = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });

    for (const { token } of [formador, formando]) {
      const criar = await request(app)
        .post("/api/v1/formandos")
        .set(auth(token))
        .send({ nome: "X Y", email: "x@teste.pt", password: "Segredo123!" });
      expect(criar.status).toBe(403);
      expect((await request(app).patch(`/api/v1/formandos/${formando.user.id}`).set(auth(token)).send({ nome: "Novo Nome" })).status).toBe(403);
      expect((await request(app).delete(`/api/v1/formandos/${formando.user.id}`).set(auth(token))).status).toBe(403);
      expect((await request(app).patch(`/api/v1/formandos/${formando.user.id}/reativar`).set(auth(token))).status).toBe(403);
      expect((await request(app).patch(`/api/v1/formandos/${formando.user.id}/password`).set(auth(token)).send({ password: "Nova12345!" })).status).toBe(403);
    }
    expect((await request(app).post("/api/v1/formandos").send({})).status).toBe(401);
  });
});
