const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

const UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(path.join(UPLOADS_TESTE, "trabalhos"), { recursive: true, force: true });
});

const resumo = (utilizador) => request(app).get("/api/v1/painel/resumo").set(comToken(utilizador));

// Agenda mais aulas (já passadas) para o mesmo cenário: 10h, 11h, ... no mesmo dia.
async function agendarAulasExtra(c, horas) {
  const aulas = [];
  for (const hora of horas) {
    const bloco = await request(app)
      .post("/api/v1/disponibilidade").set(comToken(c.formador))
      .send({ data: "2026-09-10", horaInicio: hora, estado: "LIVRE" });
    const aula = await request(app)
      .post("/api/v1/aulas").set(comToken(c.coordenador))
      .send({ turmaUcId: c.turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });
    aulas.push(aula.body.data);
  }
  return aulas;
}

function marcarAusente(c, aula) {
  return request(app)
    .put(`/api/v1/assiduidade/aula/${aula.id}`)
    .set(comToken(c.formador))
    .send({ presencas: [{ formandoId: c.formando.user.id, estado: "AUSENTE" }] });
}

describe("Painel de resumo", () => {
  test("exige autenticação", async () => {
    const res = await request(app).get("/api/v1/painel/resumo");
    expect(res.status).toBe(401);
  });

  test("formador: estado de cada UC e o que tem por tratar", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });

    const inicial = await resumo(c.formador);
    expect(inicial.status).toBe(200);
    expect(inicial.body.data.role).toBe("FORMADOR");
    expect(inicial.body.data.ucs).toHaveLength(1);
    expect(inicial.body.data.ucs[0]).toMatchObject({
      turma: "T-ACAD",
      cargaHoraria: 50,
      horasDadas: 1,
      horasEmFalta: 49,
      formandos: 1,
      notasLancadas: 0,
      trabalhosAtivos: 0,
    });
    expect(inicial.body.data.justificacoesPendentes).toBe(0);
    expect(inicial.body.data.proximasAulas).toEqual([]); // a aula do cenário já passou

    await request(app)
      .put(`/api/v1/notas/turma-uc/${c.turmaUc.id}/formando/${c.formando.user.id}`)
      .set(comToken(c.formador))
      .send({ valor: 15 });
    await marcarAusente(c, c.aula);
    await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(c.formando))
      .field("aulaId", String(c.aula.id))
      .field("motivo", "Consulta");
    const trabalho = await request(app)
      .post("/api/v1/trabalhos").set(comToken(c.formador))
      .send({ turmaUcId: c.turmaUc.id, titulo: "Relatório", descricao: "", dataLimite: "2030-12-31" });
    await request(app)
      .post(`/api/v1/trabalhos/${trabalho.body.data.id}/submissao`)
      .set(comToken(c.formando))
      .attach("ficheiro", Buffer.from("x"), "t.pdf");

    const depois = await resumo(c.formador);
    expect(depois.body.data.ucs[0]).toMatchObject({ notasLancadas: 1, trabalhosAtivos: 1 });
    expect(depois.body.data.justificacoesPendentes).toBe(1);
    expect(depois.body.data.submissoesPorAvaliar).toBe(1);
  });

  test("formador: só vê as suas UCs", async () => {
    await prepararCenarioAcademico(app);
    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res = await resumo(outro);
    expect(res.body.data.ucs).toEqual([]);
    expect(res.body.data.justificacoesPendentes).toBe(0);
  });

  test("formando: sem turma devolve semTurma; com turma mostra média, faltas e trabalhos", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const semTurma = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    expect((await resumo(semTurma)).body.data.semTurma).toBe(true);

    await request(app)
      .put(`/api/v1/notas/turma-uc/${c.turmaUc.id}/formando/${c.formando.user.id}`)
      .set(comToken(c.formador))
      .send({ valor: 15 });
    await marcarAusente(c, c.aula);
    for (const dataLimite of ["2030-12-31", "2026-01-01"]) {
      await request(app)
        .post("/api/v1/trabalhos").set(comToken(c.formador))
        .send({ turmaUcId: c.turmaUc.id, titulo: `Trabalho ${dataLimite}`, descricao: "", dataLimite });
    }

    const antes = (await resumo(c.formando)).body.data;
    expect(antes).toMatchObject({
      role: "FORMANDO",
      semTurma: false,
      notasLancadas: 1,
      media: 15,
      faltas: 1,
      faltasInjustificadas: 1,
      justificacoesPendentes: 0,
      trabalhosPorEntregar: 1,
      trabalhosEmAtraso: 1,
    });
    expect(antes.proximoPrazo).not.toBeNull();

    const just = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(c.formando))
      .field("aulaId", String(c.aula.id))
      .field("motivo", "Consulta");
    expect((await resumo(c.formando)).body.data.justificacoesPendentes).toBe(1);

    await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${just.body.data.id}/decidir`)
      .set(comToken(c.formador))
      .send({ estado: "ACEITE" });
    const depois = (await resumo(c.formando)).body.data;
    expect(depois).toMatchObject({ faltas: 1, faltasInjustificadas: 0, justificacoesPendentes: 0 });
  });

  test("coordenação: alertas, e formandos em risco só com faltas injustificadas a partir do limite", async () => {
    const c = await prepararCenarioAcademico(app, { comAula: true });
    const extra = await agendarAulasExtra(c, [10, 11]);
    const todas = [c.aula, ...extra];

    await request(app)
      .post("/api/v1/mensagens").set(comToken(c.formando))
      .send({ destino: "COORDENACAO", assunto: "Dúvida", corpo: "Texto" });

    // 2 faltas: ainda abaixo do limite (3)
    for (const aula of todas.slice(0, 2)) await marcarAusente(c, aula);
    const abaixo = (await resumo(c.coordenador)).body.data;
    expect(abaixo.role).toBe("COORDENADOR");
    expect(abaixo.limiteFaltas).toBe(3);
    expect(abaixo.formandosEmRisco).toEqual([]);
    expect(abaixo.mensagensPorLer).toBe(1);
    expect(abaixo.pedidosAcessoPorTratar).toBe(0);

    // 3 faltas: entra na lista
    await marcarAusente(c, todas[2]);
    const risco = (await resumo(c.coordenador)).body.data;
    expect(risco.formandosEmRisco).toHaveLength(1);
    expect(risco.formandosEmRisco[0]).toMatchObject({ formandoId: c.formando.user.id, turma: "T-ACAD", faltasInjustificadas: 3 });

    // Justificar e aceitar uma falta tira-o do risco
    const just = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(c.formando))
      .field("aulaId", String(c.aula.id))
      .field("motivo", "Consulta");
    expect((await resumo(c.coordenador)).body.data.justificacoesPendentes).toBe(1);
    await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${just.body.data.id}/decidir`)
      .set(comToken(c.coordenador))
      .send({ estado: "ACEITE" });
    expect((await resumo(c.coordenador)).body.data.formandosEmRisco).toEqual([]);
  });
});

describe("Painel — pendências de gestão (coordenação)", () => {
  const resumo = async (coordenador) => (await request(app).get("/api/v1/painel/resumo").set(comToken(coordenador))).body.data;

  test("assinala turma sem mediador, UC sem aulas futuras e UC com formador inativo — e deixa de assinalar quando resolvido", async () => {
    const { coordenador, formador, turma, turmaUc } = await prepararCenarioAcademico(app);

    let g = (await resumo(coordenador)).gestao;
    expect(g.turmasSemMediador.map((t) => t.codigo)).toContain("T-ACAD");
    expect(g.ucsSemAulasFuturas).toHaveLength(1);
    expect(g.ucsSemAulasFuturas[0].motivo).toBe("50h por agendar, sem aulas futuras");
    expect(g.ucsComFormadorInativo).toHaveLength(0);

    // mediador atribuído e uma aula futura agendada → deixa de haver pendências
    await request(app).patch(`/api/v1/turmas/${turma.id}`).set(comToken(coordenador)).send({ mediadorId: formador.user.id });
    const bloco = await request(app).post("/api/v1/disponibilidade").set(comToken(formador)).send({ data: "2030-10-07", horaInicio: 9, estado: "LIVRE" });
    await request(app).post("/api/v1/aulas").set(comToken(coordenador)).send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });
    g = (await resumo(coordenador)).gestao;
    expect(g.totalTurmasSemMediador).toBe(0);
    expect(g.totalUcsSemAulasFuturas).toBe(0);

    // formador desativado → UC fica assinalada
    await request(app).delete(`/api/v1/formadores/${formador.user.id}`).set(comToken(coordenador));
    g = (await resumo(coordenador)).gestao;
    expect(g.totalUcsComFormadorInativo).toBe(1);
    expect(g.ucsComFormadorInativo[0].formador).toBe(formador.user.nome);
  });

  test("formador e formando não recebem a secção de gestão", async () => {
    const { formador, formando } = await prepararCenarioAcademico(app);
    expect((await resumo(formador)).gestao).toBeUndefined();
    expect((await resumo(formando)).gestao).toBeUndefined();
  });
});

describe("Painel — aulas de hoje e próximos dias (coordenação)", () => {
  test("separa as aulas de hoje das dos próximos 7 dias e ignora as mais distantes", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenarioAcademico(app);
    const agendar = async (diasAFrente, hora) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + diasAFrente);
      const data = d.toISOString().slice(0, 10);
      const b = await request(app).post("/api/v1/disponibilidade").set(comToken(formador)).send({ data, horaInicio: hora, estado: "LIVRE" });
      await request(app).post("/api/v1/aulas").set(comToken(coordenador)).send({ turmaUcId: turmaUc.id, disponibilidadeId: b.body.data.id, modalidade: "ONLINE" });
    };
    await agendar(0, 9);
    await agendar(2, 10);
    await agendar(30, 11); // fora da janela

    const r = (await request(app).get("/api/v1/painel/resumo").set(comToken(coordenador))).body.data.aulas;
    expect(r.hoje).toHaveLength(1);
    expect(r.hoje[0]).toMatchObject({ hora: 9, uc: "UC-ACAD", turma: "T-ACAD" });
    expect(r.proximosDias).toHaveLength(1);
    expect(r.totalProximosDias).toBe(1);
  });
});
