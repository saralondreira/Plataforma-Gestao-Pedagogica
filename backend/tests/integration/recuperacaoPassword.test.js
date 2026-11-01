const request = require("supertest");
const jwt = require("jsonwebtoken");
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

const pedir = (email) => request(app).post("/api/v1/auth/esqueci-password").send({ email });
const redefinir = (token, password) => request(app).post("/api/v1/auth/redefinir-password").send({ token, password });
const login = (email, password) => request(app).post("/api/v1/auth/login").send({ email, password });

// O token vai no link do email (testOutbox guarda o texto).
function tokenDoEmail() {
  const email = testOutbox.find((e) => e.tipo === "RECUPERAR_PASSWORD");
  return email && email.texto.match(/token=([\w.-]+)/)[1];
}

describe("Recuperação de palavra-passe", () => {
  test("pedir envia um email com ligação; a nova palavra-passe funciona e a antiga deixa de funcionar", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMADOR", email: "recupera@teste.pt", password: "Antiga123!" });

    const pedido = await pedir(u.user.email);
    expect(pedido.status).toBe(200);
    expect(testOutbox.filter((e) => e.tipo === "RECUPERAR_PASSWORD").map((e) => e.to)).toEqual([u.user.email]);
    expect(testOutbox[0].texto).toContain("/pages/redefinir-password.html#token=");

    const res = await redefinir(tokenDoEmail(), "Nova12345!");
    expect(res.status).toBe(200);

    expect((await login(u.user.email, "Nova12345!")).status).toBe(200);
    expect((await login(u.user.email, "Antiga123!")).status).toBe(401);
  });

  test("a resposta é igual para emails inexistentes e contas inativas, e não envia nada", async () => {
    const inativo = await criarUtilizadorAutenticado(app, { role: "FORMANDO", email: "inativo@teste.pt" });
    await prisma.user.update({ where: { id: inativo.user.id }, data: { ativo: false } });

    const existente = await pedir("nao-existe@teste.pt");
    const desativado = await pedir("inativo@teste.pt");
    expect(existente.status).toBe(200);
    expect(desativado.body).toEqual(existente.body);
    expect(testOutbox).toHaveLength(0);
    expect((await pedir("isto-nao-e-um-email")).status).toBe(422);
  });

  test("o token só serve uma vez", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMANDO", email: "uma-vez@teste.pt" });
    await pedir(u.user.email);
    const token = tokenDoEmail();

    expect((await redefinir(token, "Primeira123!")).status).toBe(200);
    const segunda = await redefinir(token, "Segunda123!");
    expect(segunda.status).toBe(400);
    expect(segunda.body.error.code).toBe("TOKEN_INVALIDO");
    expect((await login(u.user.email, "Primeira123!")).status).toBe(200);
  });

  test("recusa tokens inventados, expirados, de outra finalidade, de conta inativa e passwords curtas", async () => {
    const u = await criarUtilizadorAutenticado(app, { role: "FORMADOR", email: "tokens@teste.pt" });
    const { passwordHash } = await prisma.user.findUnique({ where: { id: u.user.id } });
    const segredo = `${process.env.JWT_SECRET}:${passwordHash}`;

    expect((await redefinir("isto-nao-e-um-token", "Nova12345!")).status).toBe(400);
    expect((await redefinir(jwt.sign({ id: u.user.id }, "segredo-errado"), "Nova12345!")).status).toBe(400);

    const expirado = jwt.sign({ id: u.user.id, finalidade: "recuperar-password" }, segredo, { expiresIn: -10 });
    expect((await redefinir(expirado, "Nova12345!")).status).toBe(400);

    const outraFinalidade = jwt.sign({ id: u.user.id, finalidade: "login" }, segredo, { expiresIn: "1h" });
    expect((await redefinir(outraFinalidade, "Nova12345!")).status).toBe(400);

    const valido = jwt.sign({ id: u.user.id, finalidade: "recuperar-password" }, segredo, { expiresIn: "1h" });
    expect((await redefinir(valido, "123")).status).toBe(422);

    await prisma.user.update({ where: { id: u.user.id }, data: { ativo: false } });
    expect((await redefinir(valido, "Nova12345!")).status).toBe(400);
  });

  test("o limitador trava pedidos em excesso (quando ativo)", async () => {
    const { criarLimitador } = require("../../src/middleware/rateLimit");
    const express = require("express");
    const mini = express();
    mini.post("/x", criarLimitador({ janelaMs: 60000, max: 2, ativoEmTestes: true }), (req, res) => res.json({}));
    await request(mini).post("/x");
    await request(mini).post("/x");
    expect((await request(mini).post("/x")).status).toBe(429);
  });
});
