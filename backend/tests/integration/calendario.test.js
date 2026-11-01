const request = require("supertest");
const bcrypt = require("bcrypt");
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

// Aula futura (2030) para aparecer na janela do calendário.
async function cenarioComAulaFutura() {
  const c = await prepararCenarioAcademico(app);
  const bloco = await request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data: "2030-03-04", horaInicio: 9, estado: "LIVRE" });
  await request(app).post("/api/v1/aulas").set(comToken(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });
  return c;
}

const linkDe = async (utilizador) => (await request(app).post("/api/v1/calendario/link").set(comToken(utilizador))).body.data.url;
const caminho = (url) => url.slice(url.indexOf("/api/v1"));

describe("Subscrição de calendário (.ics)", () => {
  // As aulas de 2030 estão fora da janela (30 dias atrás a 12 meses à frente) —
  // por isso o feed é testado com datas relativas a hoje.
  async function cenarioProximo() {
    const c = await prepararCenarioAcademico(app);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 3);
    const data = amanha.toISOString().slice(0, 10);
    const bloco = await request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data, horaInicio: 9, estado: "LIVRE" });
    await request(app).post("/api/v1/aulas").set(comToken(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });
    return { ...c, data };
  }

  test("o link dá um .ics só com o horário do próprio utilizador, sem precisar de sessão", async () => {
    const { formador, formando, coordenador, data } = await cenarioProximo();

    const urlFormador = await linkDe(formador);
    expect(urlFormador).toContain("/api/v1/calendario/feed.ics?t=");

    const res = await request(app).get(caminho(urlFormador)); // sem Authorization
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.text).toContain("BEGIN:VCALENDAR");
    expect(res.text).toContain(`DTSTART:${data.replace(/-/g, "")}T090000`);
    expect(res.text).toContain("UC-ACAD");

    const feedFormando = await request(app).get(caminho(await linkDe(formando)));
    expect(feedFormando.text).toContain("UC-ACAD");

    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const feedOutro = await request(app).get(caminho(await linkDe(outro)));
    expect(feedOutro.text).not.toContain("BEGIN:VEVENT");

    const feedCoord = await request(app).get(caminho(await linkDe(coordenador)));
    expect(feedCoord.text).toContain("BEGIN:VEVENT");
  });

  test("tokens inválidos dão 404; mudar a password ou desativar a conta invalida o link", async () => {
    const { formador, coordenador } = await cenarioProximo();
    expect((await request(app).get("/api/v1/calendario/feed.ics?t=lixo")).status).toBe(404);
    expect((await request(app).get("/api/v1/calendario/feed.ics")).status).toBe(404);

    // token de sessão normal não serve de link de calendário
    expect((await request(app).get(`/api/v1/calendario/feed.ics?t=${formador.token}`)).status).toBe(404);

    const url = caminho(await linkDe(formador));
    expect((await request(app).get(url)).status).toBe(200);

    await prisma.user.update({ where: { id: formador.user.id }, data: { passwordHash: await bcrypt.hash("NovaPassword1!", 4) } });
    expect((await request(app).get(url)).status).toBe(404);

    const urlCoord = caminho(await linkDe(coordenador));
    await prisma.user.update({ where: { id: coordenador.user.id }, data: { ativo: false } });
    expect((await request(app).get(urlCoord)).status).toBe(404);
  });

  test("gerar o link exige sessão", async () => {
    expect((await request(app).post("/api/v1/calendario/link")).status).toBe(401);
    await cenarioComAulaFutura(); // (garante que o cenário base também funciona fora da janela)
  });
});
