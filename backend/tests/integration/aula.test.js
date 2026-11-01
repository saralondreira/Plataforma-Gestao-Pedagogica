const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

async function prepararCenario({ cargaHoraria = 50 } = {}) {
  const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
  const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

  const turmaRes = await request(app)
    .post("/api/v1/turmas")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ codigo: "T-AULA-1", designacao: "Turma Aulas", dataInicio: "2026-09-01" });

  const ucRes = await request(app)
    .post("/api/v1/ucs")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ abreviatura: "UC00034", nome: "Colaborar e trabalhar em equipa", cargaHoraria });

  const turmaUcRes = await request(app)
    .post("/api/v1/turma-ucs")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ turmaId: turmaRes.body.data.id, ucId: ucRes.body.data.id, formadorId: formador.user.id });

  const blocoRes = await request(app)
    .post("/api/v1/disponibilidade")
    .set("Authorization", `Bearer ${formador.token}`)
    .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

  return {
    coordenador,
    formador,
    turma: turmaRes.body.data,
    uc: ucRes.body.data,
    turmaUc: turmaUcRes.body.data,
    bloco: blocoRes.body.data,
  };
}

describe("Aulas", () => {
  test("coordenador agenda uma aula num bloco livre do formador da UC nesta turma", async () => {
    const { coordenador, turmaUc, bloco } = await prepararCenario();

    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });

    expect(res.status).toBe(201);
    expect(res.body.data.modalidade).toBe("PRESENCIAL");

    const turmaUcAtualizadaRes = await request(app)
      .get(`/api/v1/turma-ucs/turma/${turmaUc.turmaId}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(turmaUcAtualizadaRes.body.data[0].horasDadas).toBe(1);
    expect(turmaUcAtualizadaRes.body.data[0].horasEmFalta).toBe(turmaUc.uc.cargaHoraria - 1);
  });

  test("não deixa agendar duas aulas no mesmo bloco", async () => {
    const { coordenador, turmaUc, bloco } = await prepararCenario();

    await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "ONLINE" });

    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "ONLINE" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BLOCO_OCUPADO");
  });

  test("não deixa agendar num bloco bloqueado (ex.: almoço)", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenario();

    const blocoAlmocoRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-10", horaInicio: 12, estado: "BLOQUEADO", motivo: "Almoço" });

    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoAlmocoRes.body.data.id, modalidade: "PRESENCIAL" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BLOCO_BLOQUEADO");
  });

  test("não deixa exceder a carga horária da UC", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenario({ cargaHoraria: 1 });

    const bloco1Res = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-11", horaInicio: 9, estado: "LIVRE" });
    const bloco2Res = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-11", horaInicio: 10, estado: "LIVRE" });

    const primeiraRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco1Res.body.data.id, modalidade: "PRESENCIAL" });
    expect(primeiraRes.status).toBe(201);

    const segundaRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco2Res.body.data.id, modalidade: "PRESENCIAL" });
    expect(segundaRes.status).toBe(409);
    expect(segundaRes.body.error.code).toBe("CARGA_HORARIA_EXCEDIDA");
  });

  test("formador não pode agendar aulas (403)", async () => {
    const { formador, turmaUc, bloco } = await prepararCenario();
    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });
    expect(res.status).toBe(403);
  });

  test("coordenador cancela uma aula e o bloco fica livre outra vez", async () => {
    const { coordenador, turmaUc, bloco } = await prepararCenario();

    const criarRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });

    const cancelarRes = await request(app)
      .delete(`/api/v1/aulas/${criarRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(cancelarRes.status).toBe(204);

    const reagendarRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "ONLINE" });
    expect(reagendarRes.status).toBe(201);
  });

  test("não deixa agendar numa associação Turma/UC desativada", async () => {
    const { coordenador, turmaUc, bloco } = await prepararCenario();

    await request(app)
      .delete(`/api/v1/turma-ucs/${turmaUc.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);

    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("TURMA_UC_INATIVA");
  });

  test("cancelar aula inexistente devolve 404 AULA_NOT_FOUND", async () => {
    const { token } = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
    const res = await request(app).delete("/api/v1/aulas/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("AULA_NOT_FOUND");
  });

  // --- Correções de integridade (2026-10-20) ---

  test("não deixa agendar num bloco de disponibilidade desativado (422 BLOCO_INATIVO)", async () => {
    const { coordenador, formador, turmaUc, bloco } = await prepararCenario();

    await request(app).delete(`/api/v1/disponibilidade/${bloco.id}`).set("Authorization", `Bearer ${formador.token}`);

    const res = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("BLOCO_INATIVO");
  });

  test("o formador não pode bloquear um bloco que já tem aula agendada (409 BLOCO_OCUPADO)", async () => {
    const { coordenador, formador, turmaUc, bloco } = await prepararCenario();

    await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });

    const res = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "BLOQUEADO" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BLOCO_OCUPADO");
  });

  test("não se pode reduzir a carga horária de uma UC abaixo das horas já agendadas (422 CARGA_HORARIA_INSUFICIENTE)", async () => {
    const { coordenador, formador, uc, turmaUc, bloco } = await prepararCenario({ cargaHoraria: 5 });

    const bloco2Res = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2026-09-10", horaInicio: 10, estado: "LIVRE" });

    for (const b of [bloco, bloco2Res.body.data]) {
      await request(app)
        .post("/api/v1/aulas")
        .set("Authorization", `Bearer ${coordenador.token}`)
        .send({ turmaUcId: turmaUc.id, disponibilidadeId: b.id, modalidade: "ONLINE" });
    }

    const recusado = await request(app)
      .patch(`/api/v1/ucs/${uc.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ cargaHoraria: 1 });
    expect(recusado.status).toBe(422);
    expect(recusado.body.error.code).toBe("CARGA_HORARIA_INSUFICIENTE");

    const aceite = await request(app)
      .patch(`/api/v1/ucs/${uc.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ cargaHoraria: 2 });
    expect(aceite.status).toBe(200);
  });

  test("trocar o formador de uma UC com aulas futuras marcadas é recusado, e volta a ser permitido depois de cancelar a aula", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const blocoFuturoRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2030-01-15", horaInicio: 10, estado: "LIVRE" });

    const aulaRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoFuturoRes.body.data.id, modalidade: "PRESENCIAL" });
    expect(aulaRes.status).toBe(201);

    const recusado = await request(app)
      .patch(`/api/v1/turma-ucs/${turmaUc.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: outroFormador.user.id });
    expect(recusado.status).toBe(409);
    expect(recusado.body.error.code).toBe("TURMA_UC_COM_AULAS_FUTURAS");

    await request(app).delete(`/api/v1/aulas/${aulaRes.body.data.id}`).set("Authorization", `Bearer ${coordenador.token}`);

    const aceite = await request(app)
      .patch(`/api/v1/turma-ucs/${turmaUc.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: outroFormador.user.id });
    expect(aceite.status).toBe(200);
  });

  // --- Revisão de segurança (2026-10-20) ---

  test("a mesma turma não pode ter duas aulas à mesma data e hora, mesmo com formadores diferentes (409 TURMA_OCUPADA)", async () => {
    const { coordenador, formador, turma, turmaUc, bloco } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const uc2Res = await request(app)
      .post("/api/v1/ucs").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ abreviatura: "UC00035", nome: "Outra UC", cargaHoraria: 25 });
    const turmaUc2Res = await request(app)
      .post("/api/v1/turma-ucs").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turma.id, ucId: uc2Res.body.data.id, formadorId: outroFormador.user.id });
    const bloco2Res = await request(app)
      .post("/api/v1/disponibilidade").set("Authorization", `Bearer ${outroFormador.token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    const primeira = await request(app)
      .post("/api/v1/aulas").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, modalidade: "PRESENCIAL" });
    expect(primeira.status).toBe(201);

    const segunda = await request(app)
      .post("/api/v1/aulas").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc2Res.body.data.id, disponibilidadeId: bloco2Res.body.data.id, modalidade: "PRESENCIAL" });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe("TURMA_OCUPADA");
  });

  test("reativar uma associação com outro formador também é recusado se houver aulas futuras (409)", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenario();
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const blocoFuturoRes = await request(app)
      .post("/api/v1/disponibilidade").set("Authorization", `Bearer ${formador.token}`)
      .send({ data: "2030-01-15", horaInicio: 10, estado: "LIVRE" });
    const aulaRes = await request(app)
      .post("/api/v1/aulas").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoFuturoRes.body.data.id, modalidade: "ONLINE" });
    expect(aulaRes.status).toBe(201);

    // Desativa a associação e tenta recriá-la com outro formador (reativa a antiga).
    await request(app).delete(`/api/v1/turma-ucs/${turmaUc.id}`).set("Authorization", `Bearer ${coordenador.token}`);
    const recusado = await request(app)
      .post("/api/v1/turma-ucs").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaUc.turmaId, ucId: turmaUc.ucId, formadorId: outroFormador.user.id });
    expect(recusado.status).toBe(409);
    expect(recusado.body.error.code).toBe("TURMA_UC_COM_AULAS_FUTURAS");

    // Com o mesmo formador, reativar continua permitido.
    const mesmoFormador = await request(app)
      .post("/api/v1/turma-ucs").set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaUc.turmaId, ucId: turmaUc.ucId, formadorId: formador.user.id });
    expect(mesmoFormador.status).toBe(201);
  });
});

describe("Horário da turma", () => {
  test("coordenação vê as aulas de todas as UCs da turma, com UC e formador, filtradas por semana", async () => {
    const { coordenador, formador, turma } = await prepararCenarioAcademico(app, { comAula: true });

    const res = await request(app)
      .get(`/api/v1/aulas/turma/${turma.id}?de=2026-09-07&ate=2026-09-13`)
      .set({ Authorization: `Bearer ${coordenador.token}` });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].turmaUc.uc.abreviatura).toBe("UC-ACAD");
    expect(res.body.data[0].turmaUc.formador.id).toBe(formador.user.id);

    const foraRes = await request(app)
      .get(`/api/v1/aulas/turma/${turma.id}?de=2026-10-01&ate=2026-10-07`)
      .set({ Authorization: `Bearer ${coordenador.token}` });
    expect(foraRes.body.data).toHaveLength(0);
  });

  test("formador recebe 403 e turma inexistente 404", async () => {
    const { coordenador, formador, turma } = await prepararCenarioAcademico(app);
    expect((await request(app).get(`/api/v1/aulas/turma/${turma.id}`).set({ Authorization: `Bearer ${formador.token}` })).status).toBe(403);
    expect((await request(app).get("/api/v1/aulas/turma/999999").set({ Authorization: `Bearer ${coordenador.token}` })).status).toBe(404);
  });
});

describe("O meu horário", () => {
  test("formador vê as aulas que dá, formando as da sua turma, coordenação recebe 403", async () => {
    const { coordenador, formador, formando } = await prepararCenarioAcademico(app, { comAula: true });
    const url = "/api/v1/aulas/minhas?de=2026-09-07&ate=2026-09-13";

    const f = await request(app).get(url).set({ Authorization: `Bearer ${formador.token}` });
    expect(f.status).toBe(200);
    expect(f.body.data).toHaveLength(1);

    const a = await request(app).get(url).set({ Authorization: `Bearer ${formando.token}` });
    expect(a.body.data).toHaveLength(1);
    expect(a.body.data[0].turmaUc.uc.abreviatura).toBe("UC-ACAD");

    expect((await request(app).get(url).set({ Authorization: `Bearer ${coordenador.token}` })).status).toBe(403);
  });

  test("formando sem turma não vê aulas alheias", async () => {
    await prepararCenarioAcademico(app, { comAula: true });
    const semTurma = await criarUtilizadorAutenticado(app, { role: "FORMANDO" });
    const res = await request(app).get("/api/v1/aulas/minhas").set({ Authorization: `Bearer ${semTurma.token}` });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("Reagendar aula", () => {
  async function cenarioComDoisBlocos() {
    const cenario = await prepararCenarioAcademico(app);
    const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
    const blocos = [];
    for (const data of ["2030-05-06", "2030-05-07"]) {
      const r = await request(app).post("/api/v1/disponibilidade").set(auth(cenario.formador)).send({ data, horaInicio: 10, estado: "LIVRE" });
      blocos.push(r.body.data);
    }
    const aulaRes = await request(app)
      .post("/api/v1/aulas").set(auth(cenario.coordenador))
      .send({ turmaUcId: cenario.turmaUc.id, disponibilidadeId: blocos[0].id, modalidade: "PRESENCIAL" });
    return { ...cenario, auth, blocos, aula: aulaRes.body.data };
  }

  test("muda a aula para outro bloco livre, liberta o antigo e mantém as horas dadas", async () => {
    const { coordenador, formador, turmaUc, auth, blocos, aula } = await cenarioComDoisBlocos();

    const res = await request(app)
      .patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(coordenador))
      .send({ disponibilidadeId: blocos[1].id, modalidade: "ONLINE" });
    expect(res.status).toBe(200);
    expect(res.body.data.data.slice(0, 10)).toBe("2030-05-07");
    expect(res.body.data.modalidade).toBe("ONLINE");

    const aulas = await request(app).get(`/api/v1/aulas/turma-uc/${turmaUc.id}`).set(auth(coordenador));
    expect(aulas.body.data).toHaveLength(1);

    // o bloco antigo ficou livre: dá para agendar lá outra vez
    const outra = await request(app)
      .patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(coordenador))
      .send({ disponibilidadeId: blocos[0].id });
    expect(outra.status).toBe(200);
    expect(formador).toBeTruthy();
  });

  test("recusa bloco bloqueado, bloco de outro formador e formador a tentar reagendar", async () => {
    const { coordenador, formador, auth, blocos, aula } = await cenarioComDoisBlocos();

    const bloqueado = await request(app).post("/api/v1/disponibilidade").set(auth(formador)).send({ data: "2030-05-08", horaInicio: 10, estado: "BLOQUEADO" });
    const r1 = await request(app).patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(coordenador)).send({ disponibilidadeId: bloqueado.body.data.id });
    expect(r1.status).toBe(409);

    const outro = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const alheio = await request(app).post("/api/v1/disponibilidade").set(auth(outro)).send({ data: "2030-05-09", horaInicio: 10, estado: "LIVRE" });
    const r2 = await request(app).patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(coordenador)).send({ disponibilidadeId: alheio.body.data.id });
    expect(r2.status).toBe(422);

    const r3 = await request(app).patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(formador)).send({ disponibilidadeId: blocos[1].id });
    expect(r3.status).toBe(403);
  });

  test("não deixa reagendar uma aula que já aconteceu (422 AULA_PASSADA)", async () => {
    const { coordenador, formador, auth, blocos } = await prepararCenarioAcademico(app, { comAula: true }).then(async (c) => {
      const r = await request(app).post("/api/v1/disponibilidade").set({ Authorization: `Bearer ${c.formador.token}` }).send({ data: "2030-06-03", horaInicio: 11, estado: "LIVRE" });
      return { ...c, auth: (u) => ({ Authorization: `Bearer ${u.token}` }), blocos: [r.body.data] };
    });
    const aulaPassada = (await prisma.aula.findFirst()).id;
    const res = await request(app).patch(`/api/v1/aulas/${aulaPassada}/reagendar`).set(auth(coordenador)).send({ disponibilidadeId: blocos[0].id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("AULA_PASSADA");
    expect(formador).toBeTruthy();
  });
});

describe("Relatório de horas por formador", () => {
  test("soma horas dadas (passadas) e por dar (futuras) por formador, com detalhe por UC", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenarioAcademico(app, { comAula: true });
    const auth = { Authorization: `Bearer ${coordenador.token}` };
    const bloco = await request(app).post("/api/v1/disponibilidade").set({ Authorization: `Bearer ${formador.token}` }).send({ data: "2030-05-06", horaInicio: 10, estado: "LIVRE" });
    await request(app).post("/api/v1/aulas").set(auth).send({ turmaUcId: turmaUc.id, disponibilidadeId: bloco.body.data.id, modalidade: "ONLINE" });

    const res = await request(app).get("/api/v1/aulas/relatorio-formadores").set(auth);
    expect(res.status).toBe(200);
    const linha = res.body.data.find((r) => r.formador.id === formador.user.id);
    expect(linha.horasDadas).toBe(1);
    expect(linha.horasPorDar).toBe(1);
    expect(linha.horasTotal).toBe(2);
    expect(linha.blocosLivres).toBe(0); // ambos os blocos têm aula
    expect(linha.detalhe).toEqual([{ turma: "T-ACAD", uc: "UC-ACAD", ucNome: "UC Académica", dadas: 1, porDar: 1 }]);

    const filtrado = await request(app).get("/api/v1/aulas/relatorio-formadores?de=2030-01-01&ate=2030-12-31").set(auth);
    const l2 = filtrado.body.data.find((r) => r.formador.id === formador.user.id);
    expect(l2.horasDadas).toBe(0);
    expect(l2.horasPorDar).toBe(1);
  });

  test("só a coordenação vê o relatório (403 ao formador)", async () => {
    const { formador } = await prepararCenarioAcademico(app);
    const res = await request(app).get("/api/v1/aulas/relatorio-formadores").set({ Authorization: `Bearer ${formador.token}` });
    expect(res.status).toBe(403);
  });
});

describe("Avisos de mudança de aula", () => {
  async function cenarioFuturo() {
    limparTestOutbox(); // emails de testes anteriores não contam
    const c = await prepararCenarioAcademico(app);
    const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
    const blocos = [];
    for (const data of ["2030-07-01", "2030-07-02"]) {
      const r = await request(app).post("/api/v1/disponibilidade").set(auth(c.formador)).send({ data, horaInicio: 9, estado: "LIVRE" });
      blocos.push(r.body.data);
    }
    const aula = (await request(app).post("/api/v1/aulas").set(auth(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: blocos[0].id, modalidade: "PRESENCIAL" })).body.data;
    // agendar não avisa ninguém: confirma-se ANTES de limpar a caixa de saída
    expect(testOutbox.filter((e) => e.tipo === "AULA_REAGENDADA" || e.tipo === "AULA_CANCELADA")).toHaveLength(0);
    limparTestOutbox();
    return { ...c, auth, blocos, aula };
  }

  test("agendar não envia emails; reagendar avisa o formador e os formandos da turma (sem dados sensíveis)", async () => {
    const { coordenador, formador, formando, auth, blocos, aula } = await cenarioFuturo();
    expect(testOutbox).toHaveLength(0);

    await request(app).patch(`/api/v1/aulas/${aula.id}/reagendar`).set(auth(coordenador)).send({ disponibilidadeId: blocos[1].id });

    const avisos = testOutbox.filter((e) => e.tipo === "AULA_REAGENDADA");
    expect(avisos.map((e) => e.to).sort()).toEqual([formador.user.email, formando.user.email].sort());
    expect(JSON.stringify(avisos[0])).toContain("01/07/2030");
    expect(JSON.stringify(avisos[0])).toContain("02/07/2030");
  });

  test("cancelar uma aula futura avisa; cancelar uma já passada não", async () => {
    const cen = await cenarioFuturo();
    const { coordenador, auth, aula } = cen;
    const cenarioFuturo2 = async () => cen;
    await request(app).delete(`/api/v1/aulas/${aula.id}`).set(auth(coordenador));
    expect(testOutbox.filter((e) => e.tipo === "AULA_CANCELADA")).toHaveLength(2);

    const { formador, coordenador: coord, turmaUc } = await cenarioFuturo2();
    const blocoPassado = await request(app).post("/api/v1/disponibilidade").set(auth(formador)).send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });
    const passada = (await request(app).post("/api/v1/aulas").set(auth(coord)).send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoPassado.body.data.id, modalidade: "PRESENCIAL" })).body.data;
    limparTestOutbox();
    await request(app).delete(`/api/v1/aulas/${passada.id}`).set(auth(coord));
    expect(testOutbox.filter((e) => e.tipo === "AULA_CANCELADA")).toHaveLength(0);
  });
});

describe("Agendar aulas em lote", () => {
  test("agenda várias aulas de uma vez e devolve as que falharam com o motivo, sem parar nas outras", async () => {
    const c = await prepararCenarioAcademico(app);
    const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
    const ids = [];
    for (const data of ["2030-08-05", "2030-08-06", "2030-08-07"]) {
      const r = await request(app).post("/api/v1/disponibilidade").set(auth(c.formador)).send({ data, horaInicio: 14, estado: "LIVRE" });
      ids.push(r.body.data.id);
    }
    const bloqueado = await request(app).post("/api/v1/disponibilidade").set(auth(c.formador)).send({ data: "2030-08-08", horaInicio: 14, estado: "BLOQUEADO" });

    const res = await request(app)
      .post("/api/v1/aulas/lote").set(auth(c.coordenador))
      .send({ turmaUcId: c.turmaUc.id, disponibilidadeIds: [...ids, bloqueado.body.data.id, 999999], modalidade: "ONLINE" });
    expect(res.status).toBe(201);
    expect(res.body.data.criadas).toBe(3);
    expect(res.body.data.falhadas).toHaveLength(2);
    expect(res.body.data.falhadas.map((f) => f.codigo).filter(Boolean)).toEqual(["BLOQUEADO"].map(() => "BLOCO_BLOQUEADO"));

    const aulas = await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(auth(c.coordenador));
    expect(aulas.body.data).toHaveLength(3);
  });

  test("respeita a carga horária: as aulas a mais ficam nas falhadas; formador recebe 403; lista vazia 422", async () => {
    const c = await prepararCenarioAcademico(app);
    const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
    await request(app).patch(`/api/v1/ucs/${c.turmaUc.uc.id}`).set(auth(c.coordenador)).send({ cargaHoraria: 2 });
    const ids = [];
    for (const data of ["2030-09-02", "2030-09-03", "2030-09-04"]) {
      ids.push((await request(app).post("/api/v1/disponibilidade").set(auth(c.formador)).send({ data, horaInicio: 8, estado: "LIVRE" })).body.data.id);
    }
    const res = await request(app).post("/api/v1/aulas/lote").set(auth(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeIds: ids, modalidade: "PRESENCIAL" });
    expect(res.body.data.criadas).toBe(2);
    expect(res.body.data.falhadas[0].codigo).toBe("CARGA_HORARIA_EXCEDIDA");

    expect((await request(app).post("/api/v1/aulas/lote").set(auth(c.formador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeIds: ids, modalidade: "ONLINE" })).status).toBe(403);
    expect((await request(app).post("/api/v1/aulas/lote").set(auth(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeIds: [], modalidade: "ONLINE" })).status).toBe(422);
  });
});

describe("Horário geral", () => {
  test("coordenação vê as aulas de todas as turmas e filtra por turma/formador/semana; formador recebe 403", async () => {
    const { coordenador, formador, turma } = await prepararCenarioAcademico(app, { comAula: true });
    const auth = { Authorization: `Bearer ${coordenador.token}` };

    const todas = await request(app).get("/api/v1/aulas?de=2026-09-07&ate=2026-09-13").set(auth);
    expect(todas.status).toBe(200);
    expect(todas.body.data).toHaveLength(1);
    expect(todas.body.data[0].turmaUc.turma.codigo).toBe("T-ACAD");

    const porTurma = await request(app).get(`/api/v1/aulas?turmaId=${turma.id}&formadorId=${formador.user.id}`).set(auth);
    expect(porTurma.body.data).toHaveLength(1);
    const outroFormador = await request(app).get("/api/v1/aulas?formadorId=999999").set(auth);
    expect(outroFormador.body.data).toHaveLength(0);
    const outraSemana = await request(app).get("/api/v1/aulas?de=2026-10-01&ate=2026-10-07").set(auth);
    expect(outraSemana.body.data).toHaveLength(0);

    expect((await request(app).get("/api/v1/aulas").set({ Authorization: `Bearer ${formador.token}` })).status).toBe(403);
  });
});

describe("Repetir semana", () => {
  const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
  async function bloco(formador, data, hora = 9) {
    return (await request(app).post("/api/v1/disponibilidade").set(auth(formador)).send({ data, horaInicio: hora, estado: "LIVRE" })).body.data;
  }

  test("repete as aulas da semana nas seguintes (mesmo dia/hora) e reporta as semanas em que o formador não marcou disponibilidade", async () => {
    const c = await prepararCenarioAcademico(app);
    // semana de 2030-04-01 (segunda): aula na terça 2030-04-02 às 9h
    const b0 = await bloco(c.formador, "2030-04-02");
    await request(app).post("/api/v1/aulas").set(auth(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: b0.id, modalidade: "ONLINE" });
    await bloco(c.formador, "2030-04-09"); // semana +1 ok
    // semana +2 (2030-04-16): sem bloco; semana +3 (2030-04-23): ok
    await bloco(c.formador, "2030-04-23");

    const res = await request(app).post("/api/v1/aulas/repetir-semana").set(auth(c.coordenador)).send({ turmaId: c.turma.id, semanaDe: "2030-04-04", numSemanas: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.aulasNaSemana).toBe(1);
    expect(res.body.data.criadas).toBe(2);
    expect(res.body.data.falhadas).toHaveLength(1);
    expect(res.body.data.falhadas[0]).toMatchObject({ quando: "2030-04-16 09:00", codigo: "SEM_BLOCO" });

    const aulas = await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(auth(c.coordenador));
    expect(aulas.body.data.map((a) => a.data.slice(0, 10))).toEqual(["2030-04-02", "2030-04-09", "2030-04-23"]);
    expect(aulas.body.data.every((a) => a.modalidade === "ONLINE")).toBe(true);
  });

  test("recusa semana sem aulas (422), turma inexistente (404), dados inválidos (422) e formador (403)", async () => {
    const c = await prepararCenarioAcademico(app);
    const corpo = { turmaId: c.turma.id, semanaDe: "2030-05-06", numSemanas: 2 };
    const vazia = await request(app).post("/api/v1/aulas/repetir-semana").set(auth(c.coordenador)).send(corpo);
    expect(vazia.status).toBe(422);
    expect(vazia.body.error.code).toBe("SEMANA_SEM_AULAS");
    expect((await request(app).post("/api/v1/aulas/repetir-semana").set(auth(c.coordenador)).send({ ...corpo, turmaId: 999999 })).status).toBe(404);
    expect((await request(app).post("/api/v1/aulas/repetir-semana").set(auth(c.coordenador)).send({ ...corpo, numSemanas: 99 })).status).toBe(422);
    expect((await request(app).post("/api/v1/aulas/repetir-semana").set(auth(c.formador)).send(corpo)).status).toBe(403);
  });
});
