const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados } = require("../helpers");
const { semear, PASSWORD_DEMO } = require("../../scripts/seed-demo");

const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "documentos");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

const entrar = async (email) => (await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD_DEMO })).body.data.token;

describe("Dados de demonstração (seed)", () => {
  test("criam a turma completa e todas as contas entram com a palavra-passe de demo", async () => {
    const r = await semear();
    expect(await prisma.user.count()).toBe(10); // 1 coordenador + 3 formadores + 6 formandos
    expect(await prisma.aula.count()).toBe(12);
    expect(r.turma.mediadorId).toBe(r.formadores[0].id);

    for (const u of [r.coordenador, ...r.formadores, ...r.formandos]) {
      expect(await entrar(u.email)).toEqual(expect.any(String));
    }
  });

  test("mostram a coordenação os três semáforos e um formando em risco", async () => {
    const r = await semear();
    const token = await entrar(r.coordenador.email);
    const res = await request(app).get("/api/v1/painel/resumo").set({ Authorization: `Bearer ${token}` });

    expect(res.body.data.conformidade).toMatchObject({ total: 3, vermelho: 2 });
    expect(res.body.data.formandosEmRisco.map((f) => f.nome)).toEqual(["Rui Costa"]);

    const detalhe = await request(app).get("/api/v1/painel/conformidade").set({ Authorization: `Bearer ${token}` });
    const porUc = Object.fromEntries(detalhe.body.data.ucs.map((u) => [u.uc, u.estado]));
    expect(porUc.UC00605).toBe("VERMELHO"); // sumário em falta e sem documentos
    expect(porUc.UC00614).toBe("VERMELHO"); // sumário rejeitado
    expect(porUc.UC00604).toBe("VERDE");
  });

  test("os documentos de demo descarregam (o ficheiro existe em disco)", async () => {
    const r = await semear();
    const token = await entrar(r.formandos[0].email);
    const lista = await request(app).get("/api/v1/documentos/turma").set({ Authorization: `Bearer ${token}` });
    expect(lista.body.data).toHaveLength(2);
    const res = await request(app).get(`/api/v1/documentos/${lista.body.data[0].id}/ficheiro`).set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
  });
});
