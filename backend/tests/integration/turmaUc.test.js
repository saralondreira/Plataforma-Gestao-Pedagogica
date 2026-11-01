const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico } = require("../helpers");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
});

async function prepararCenario() {
  const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
  const formadorA = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
  const formadorB = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

  const turmaXRes = await request(app)
    .post("/api/v1/turmas")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ codigo: "T-TUC-X", designacao: "Turma X", dataInicio: "2026-09-01" });
  const turmaYRes = await request(app)
    .post("/api/v1/turmas")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ codigo: "T-TUC-Y", designacao: "Turma Y", dataInicio: "2026-09-01" });

  const ucRes = await request(app)
    .post("/api/v1/ucs")
    .set("Authorization", `Bearer ${coordenador.token}`)
    .send({ abreviatura: "UC0004", nome: "Comunicar e Negociar", cargaHoraria: 50 });

  return { coordenador, formadorA, formadorB, turmaX: turmaXRes.body.data, turmaY: turmaYRes.body.data, uc: ucRes.body.data };
}

describe("TurmaUCs — associação de UCs do catálogo a turmas", () => {
  test("a mesma UC pode ser associada a turmas diferentes, com formadores diferentes", async () => {
    const { coordenador, formadorA, formadorB, turmaX, turmaY, uc } = await prepararCenario();

    const assocXRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });
    expect(assocXRes.status).toBe(201);
    expect(assocXRes.body.data.formadorId).toBe(formadorA.user.id);
    expect(assocXRes.body.data.horasDadas).toBe(0);
    expect(assocXRes.body.data.horasEmFalta).toBe(50);

    const assocYRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaY.id, ucId: uc.id, formadorId: formadorB.user.id });
    expect(assocYRes.status).toBe(201);
    expect(assocYRes.body.data.formadorId).toBe(formadorB.user.id);

    const listaXRes = await request(app)
      .get(`/api/v1/turma-ucs/turma/${turmaX.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaXRes.body.data).toHaveLength(1);
    expect(listaXRes.body.data[0].formador.id).toBe(formadorA.user.id);
  });

  test("não deixa associar a mesma UC duas vezes à mesma turma", async () => {
    const { coordenador, formadorA, turmaX, uc } = await prepararCenario();

    await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    const res = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("UC_JA_ASSOCIADA");
  });

  test("rejeita formador inválido ao associar", async () => {
    const { coordenador, turmaX, uc } = await prepararCenario();
    const outroCoordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });

    const res = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: outroCoordenador.user.id });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("FORMADOR_INVALIDO");
  });

  test("coordenador muda o formador de uma UC numa turma", async () => {
    const { coordenador, formadorA, formadorB, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    const atualizarRes = await request(app)
      .patch(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: formadorB.user.id });

    expect(atualizarRes.status).toBe(200);
    expect(atualizarRes.body.data.formadorId).toBe(formadorB.user.id);
  });

  test("formador não pode associar UCs a turmas (403)", async () => {
    const { formadorA, turmaX, uc } = await prepararCenario();
    const res = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${formadorA.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });
    expect(res.status).toBe(403);
  });

  test("coordenador remove uma UC de uma turma sem aulas agendadas", async () => {
    const { coordenador, formadorA, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    const removerRes = await request(app)
      .delete(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(removerRes.status).toBe(204);
  });

  // Antes esta operação era recusada com 409 TURMA_UC_COM_AULAS — desde que
  // remover passou a ser uma flag (soft delete), a associação fica só
  // inativa e as aulas já dadas mantêm-se; só deixa de aceitar aulas novas.
  test("remover uma UC de uma turma com aulas já agendadas não é bloqueado, e as aulas mantêm-se", async () => {
    const { coordenador, formadorA, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    const blocoRes = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formadorA.token}`)
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });

    await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: assocRes.body.data.id, disponibilidadeId: blocoRes.body.data.id, modalidade: "PRESENCIAL" });

    const removerRes = await request(app)
      .delete(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(removerRes.status).toBe(204);

    const aulasRes = await request(app)
      .get(`/api/v1/aulas/turma-uc/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(aulasRes.body.data).toHaveLength(1);

    // Fica inativa: não aceita novas aulas.
    const bloco2Res = await request(app)
      .post("/api/v1/disponibilidade")
      .set("Authorization", `Bearer ${formadorA.token}`)
      .send({ data: "2026-09-11", horaInicio: 9, estado: "LIVRE" });
    const novaAulaRes = await request(app)
      .post("/api/v1/aulas")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaUcId: assocRes.body.data.id, disponibilidadeId: bloco2Res.body.data.id, modalidade: "PRESENCIAL" });
    expect(novaAulaRes.status).toBe(422);
    expect(novaAulaRes.body.error.code).toBe("TURMA_UC_INATIVA");
  });

  test("associação some da listagem por omissão depois de removida, e reativar traz-a de volta", async () => {
    const { coordenador, formadorA, formadorB, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    await request(app)
      .delete(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);

    const listaRes = await request(app)
      .get(`/api/v1/turma-ucs/turma/${turmaX.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaRes.body.data).toHaveLength(0);

    const reativarRes = await request(app)
      .patch(`/api/v1/turma-ucs/${assocRes.body.data.id}/reativar`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(reativarRes.status).toBe(200);
    expect(reativarRes.body.data.ativo).toBe(true);
    expect(reativarRes.body.data.formadorId).toBe(formadorA.user.id);
  });

  test("associar de novo a mesma UC à mesma turma depois de removida reativa a associação (com o novo formador)", async () => {
    const { coordenador, formadorA, formadorB, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    await request(app)
      .delete(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);

    const reassociarRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorB.user.id });

    expect(reassociarRes.status).toBe(201);
    expect(reassociarRes.body.data.id).toBe(assocRes.body.data.id);
    expect(reassociarRes.body.data.formadorId).toBe(formadorB.user.id);

    const listaRes = await request(app)
      .get(`/api/v1/turma-ucs/turma/${turmaX.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`);
    expect(listaRes.body.data).toHaveLength(1);
  });

  test("associar um formador a uma UC numa turma envia-lhe uma notificação por email", async () => {
    const { coordenador, formadorA, turmaX, uc } = await prepararCenario();

    const res = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });

    expect(res.status).toBe(201);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].tipo).toBe("UC_ATRIBUIDA");
    expect(testOutbox[0].to).toBe(formadorA.user.email);
    expect(testOutbox[0].turmaCodigo).toBe(turmaX.codigo);
    expect(testOutbox[0].ucAbreviatura).toBe(uc.abreviatura);
  });

  test("mudar o formador de uma UC envia notificação só ao novo formador", async () => {
    const { coordenador, formadorA, formadorB, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });
    limparTestOutbox(); // ignora o email da associação inicial, só nos interessa a mudança

    const atualizarRes = await request(app)
      .patch(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: formadorB.user.id });

    expect(atualizarRes.status).toBe(200);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].to).toBe(formadorB.user.email);
  });

  test("atualizar uma associação sem mudar o formador não envia notificação", async () => {
    const { coordenador, formadorA, turmaX, uc } = await prepararCenario();

    const assocRes = await request(app)
      .post("/api/v1/turma-ucs")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ turmaId: turmaX.id, ucId: uc.id, formadorId: formadorA.user.id });
    limparTestOutbox();

    const atualizarRes = await request(app)
      .patch(`/api/v1/turma-ucs/${assocRes.body.data.id}`)
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: formadorA.user.id });

    expect(atualizarRes.status).toBe(200);
    expect(testOutbox).toHaveLength(0);
  });

  test("editar associação Turma/UC inexistente devolve 404 TURMA_UC_NOT_FOUND", async () => {
    const { coordenador } = await prepararCenario();
    const res = await request(app)
      .patch("/api/v1/turma-ucs/999999")
      .set("Authorization", `Bearer ${coordenador.token}`)
      .send({ formadorId: coordenador.user.id });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TURMA_UC_NOT_FOUND");
  });
});

describe("Copiar UCs de uma turma para outra", () => {
  async function criarTurmaDestino(coordenador, codigo = "T-DESTINO") {
    const res = await request(app)
      .post("/api/v1/turmas").set({ Authorization: `Bearer ${coordenador.token}` })
      .send({ codigo, designacao: "Turma Destino", dataInicio: "2026-09-01" });
    return res.body.data;
  }

  test("copia as UCs com os mesmos formadores, ignora as já associadas e notifica o formador", async () => {
    const { coordenador, formador, turma } = await prepararCenarioAcademico(app);
    const destino = await criarTurmaDestino(coordenador);
    const auth = { Authorization: `Bearer ${coordenador.token}` };
    limparTestOutbox();

    const res = await request(app).post("/api/v1/turma-ucs/copiar").set(auth).send({ origemTurmaId: turma.id, destinoTurmaId: destino.id });
    expect(res.status).toBe(201);
    expect(res.body.data.copiadas).toEqual(["UC-ACAD"]);
    expect(res.body.data.ignoradas).toEqual([]);
    expect(testOutbox.length).toBeGreaterThan(0);

    const lista = await request(app).get(`/api/v1/turma-ucs/turma/${destino.id}`).set(auth);
    expect(lista.body.data).toHaveLength(1);
    expect(lista.body.data[0].formador.id).toBe(formador.user.id);

    const segunda = await request(app).post("/api/v1/turma-ucs/copiar").set(auth).send({ origemTurmaId: turma.id, destinoTurmaId: destino.id });
    expect(segunda.body.data.copiadas).toEqual([]);
    expect(segunda.body.data.ignoradas[0].uc).toBe("UC-ACAD");
  });

  test("recusa turmas iguais (422), turma inexistente (404) e formador (403)", async () => {
    const { coordenador, formador, turma } = await prepararCenarioAcademico(app);
    const auth = { Authorization: `Bearer ${coordenador.token}` };

    const iguais = await request(app).post("/api/v1/turma-ucs/copiar").set(auth).send({ origemTurmaId: turma.id, destinoTurmaId: turma.id });
    expect(iguais.status).toBe(422);
    expect(iguais.body.error.code).toBe("TURMAS_IGUAIS");

    const inexistente = await request(app).post("/api/v1/turma-ucs/copiar").set(auth).send({ origemTurmaId: turma.id, destinoTurmaId: 999999 });
    expect(inexistente.status).toBe(404);

    const proibido = await request(app).post("/api/v1/turma-ucs/copiar").set({ Authorization: `Bearer ${formador.token}` }).send({ origemTurmaId: turma.id, destinoTurmaId: 1 });
    expect(proibido.status).toBe(403);
  });
});

describe("Substituir formador com aulas futuras", () => {
  async function cenario() {
    const c = await prepararCenarioAcademico(app);
    const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
    const novo = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const aulas = [];
    for (const data of ["2030-11-04", "2030-11-05"]) {
      const b = await request(app).post("/api/v1/disponibilidade").set(auth(c.formador)).send({ data, horaInicio: 10, estado: "LIVRE" });
      aulas.push((await request(app).post("/api/v1/aulas").set(auth(c.coordenador)).send({ turmaUcId: c.turmaUc.id, disponibilidadeId: b.body.data.id, modalidade: "PRESENCIAL" })).body.data);
    }
    return { ...c, auth, novo, aulas };
  }
  const url = (c) => `/api/v1/turma-ucs/${c.turmaUc.id}/substituir-formador`;

  test("passa as aulas futuras para blocos livres do novo formador (mesma data/hora) e muda o formador", async () => {
    const c = await cenario();
    for (const data of ["2030-11-04", "2030-11-05"]) {
      await request(app).post("/api/v1/disponibilidade").set(c.auth(c.novo)).send({ data, horaInicio: 10, estado: "LIVRE" });
    }
    const res = await request(app).patch(url(c)).set(c.auth(c.coordenador)).send({ formadorId: c.novo.user.id });
    expect(res.status).toBe(200);
    expect(res.body.data.movidas).toBe(2);
    expect(res.body.data.canceladas).toBe(0);
    expect(res.body.data.turmaUc.formador.id).toBe(c.novo.user.id);

    const meu = await request(app).get("/api/v1/aulas/minhas?de=2030-11-01&ate=2030-11-30").set(c.auth(c.novo));
    expect(meu.body.data).toHaveLength(2);
    // o formador antigo ficou com os blocos livres de novo
    const antigo = await request(app).get("/api/v1/aulas/minhas").set(c.auth(c.formador));
    expect(antigo.body.data).toHaveLength(0);
  });

  test("sem blocos livres no novo formador recusa sem alterar nada; com cancelarSemBloco cancela essas aulas", async () => {
    const c = await cenario();
    await request(app).post("/api/v1/disponibilidade").set(c.auth(c.novo)).send({ data: "2030-11-04", horaInicio: 10, estado: "LIVRE" }); // só uma das duas

    const recusa = await request(app).patch(url(c)).set(c.auth(c.coordenador)).send({ formadorId: c.novo.user.id });
    expect(recusa.status).toBe(409);
    expect(recusa.body.error.code).toBe("SEM_BLOCOS_LIVRES");
    const intacto = await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(c.auth(c.coordenador));
    expect(intacto.body.data).toHaveLength(2);

    const ok = await request(app).patch(url(c)).set(c.auth(c.coordenador)).send({ formadorId: c.novo.user.id, cancelarSemBloco: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.movidas).toBe(1);
    expect(ok.body.data.canceladas).toBe(1);
    const depois = await request(app).get(`/api/v1/aulas/turma-uc/${c.turmaUc.id}`).set(c.auth(c.coordenador));
    expect(depois.body.data).toHaveLength(1);
  });

  test("recusa o mesmo formador (422) e formador a tentar (403)", async () => {
    const c = await cenario();
    const igual = await request(app).patch(url(c)).set(c.auth(c.coordenador)).send({ formadorId: c.formador.user.id });
    expect(igual.status).toBe(422);
    expect((await request(app).patch(url(c)).set(c.auth(c.formador)).send({ formadorId: c.novo.user.id })).status).toBe(403);
  });
});
