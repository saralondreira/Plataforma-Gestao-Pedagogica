const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { passwordNova } = require("../../src/lib/validacao");
const { hojeEmLisboa, fimDeHojeEmLisboa } = require("../../src/lib/tempo");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

// Limitações conhecidas que foram corrigidas (2026-10-28): fuso de Lisboa, palavra-passe mínima
// e pedidos simultâneos sobre a mesma agenda.

describe("Dia de hoje em Lisboa", () => {
  test("no verão, perto da meia-noite UTC, já é o dia seguinte em Lisboa", () => {
    expect(hojeEmLisboa(new Date("2026-07-01T23:30:00Z")).toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(hojeEmLisboa(new Date("2026-07-01T12:00:00Z")).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  test("no inverno Lisboa coincide com UTC; o fim do dia é 23:59:59.999", () => {
    expect(hojeEmLisboa(new Date("2026-01-10T23:30:00Z")).toISOString()).toBe("2026-01-10T00:00:00.000Z");
    expect(fimDeHojeEmLisboa(new Date("2026-01-10T10:00:00Z")).toISOString()).toBe("2026-01-10T23:59:59.999Z");
  });
});

describe("Palavra-passe mínima", () => {
  test("recusa menos de 8 caracteres e aceita 8", () => {
    expect(passwordNova.safeParse("1234567").success).toBe(false);
    expect(passwordNova.safeParse("12345678").success).toBe(true);
  });
});

describe("Pedidos simultâneos à agenda", () => {
  async function bloco(c, horaInicio, data = "2030-07-01") {
    const res = await request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data, horaInicio, estado: "LIVRE" });
    return res.body.data;
  }
  const agendar = (c, disponibilidadeId) =>
    request(app).post("/api/v1/aulas").set(comToken(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId, modalidade: "PRESENCIAL" });

  test("dois agendamentos no mesmo bloco: só um fica gravado", async () => {
    const c = await prepararCenarioAcademico(app);
    const b = await bloco(c, 9);
    const estados = (await Promise.all([agendar(c, b.id), agendar(c, b.id)])).map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    expect(await prisma.aula.count()).toBe(1);
  });

  test("dois agendamentos com a carga horária quase esgotada: não se ultrapassa o limite", async () => {
    const c = await prepararCenarioAcademico(app);
    const ucId = c.turmaUc.ucId ?? c.turmaUc.uc?.id;
    await request(app).patch(`/api/v1/ucs/${ucId}`).set(comToken(c.coordenador)).send({ cargaHoraria: 1 });
    const [b1, b2] = [await bloco(c, 9), await bloco(c, 10)];
    const respostas = await Promise.all([agendar(c, b1.id), agendar(c, b2.id)]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.aula.count()).toBe(1);
  });

  test("bloquear um bloco enquanto é agendado: ou a aula ou o bloqueio, nunca os dois", async () => {
    const c = await prepararCenarioAcademico(app);
    const b = await bloco(c, 9);
    const [aula, bloqueio] = await Promise.all([
      agendar(c, b.id),
      request(app).post("/api/v1/disponibilidade").set(comToken(c.formador)).send({ data: "2030-07-01", horaInicio: 9, estado: "BLOQUEADO", motivo: "Almoço" }),
    ]);
    const bd = await prisma.disponibilidade.findUnique({ where: { id: b.id }, include: { aula: true } });
    // Se a aula ficou gravada, o bloco não pode ter sido bloqueado (e vice-versa).
    if (bd.aula) {
      expect(aula.status).toBe(201);
      expect(bd.estado).toBe("LIVRE");
    } else {
      expect(aula.status).not.toBe(201);
      expect(bloqueio.status).toBe(201);
    }
  });
});

describe("Formador de cada aula", () => {
  test("trocar o formador da UC não altera as aulas já dadas", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true }); // uma aula já dada (2026-09-10)
    const novo = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const livre = (quem) => request(app).post("/api/v1/disponibilidade").set(comToken(quem)).send({ data: "2030-07-01", horaInicio: 9, estado: "LIVRE" });

    const blocoAntigo = (await livre(c.formador)).body.data;
    const futura = await request(app).post("/api/v1/aulas").set(comToken(c.coordenador))
      .send({ turmaUcId: c.turmaUc.id, disponibilidadeId: blocoAntigo.id, modalidade: "PRESENCIAL" });
    expect(futura.status).toBe(201);
    await livre(novo); // o novo formador tem a mesma hora livre

    const troca = await request(app).patch(`/api/v1/turma-ucs/${c.turmaUc.id}/substituir-formador`).set(comToken(c.coordenador)).send({ formadorId: novo.user.id });
    expect(troca.status).toBe(200);

    // Relatório de horas: a aula dada continua a ser do formador antigo; a futura passa para o novo.
    const relatorio = (await request(app).get("/api/v1/aulas/relatorio-formadores").set(comToken(c.coordenador))).body.data;
    const linha = (id) => relatorio.find((r) => r.formador.id === id);
    expect(linha(c.formador.user.id)).toMatchObject({ horasDadas: 1, horasPorDar: 0 });
    expect(linha(novo.user.id)).toMatchObject({ horasDadas: 0, horasPorDar: 1 });

    // Horário geral: cada aula mostra quem a deu.
    const geral = (await request(app).get("/api/v1/aulas?de=2026-01-01&ate=2031-01-01").set(comToken(c.coordenador))).body.data;
    const dada = geral.find((a) => a.data.startsWith("2026-09-10"));
    const agendada = geral.find((a) => a.data.startsWith("2030-07-01"));
    expect(dada.turmaUc.formador.id).toBe(c.formador.user.id);
    expect(agendada.turmaUc.formador.id).toBe(novo.user.id);

    // O horário pessoal de cada formador só tem as aulas que ele dá.
    const doAntigo = (await request(app).get("/api/v1/aulas/minhas").set(comToken(c.formador))).body.data;
    const doNovo = (await request(app).get("/api/v1/aulas/minhas").set(comToken(novo))).body.data;
    expect(doAntigo.map((a) => a.data.slice(0, 10))).toEqual(["2026-09-10"]);
    expect(doNovo.map((a) => a.data.slice(0, 10))).toEqual(["2030-07-01"]);
  });
});
