const request = require("supertest");
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

function enviar(remetente, corpo) {
  return request(app)
    .post("/api/v1/mensagens")
    .set(comToken(remetente))
    .send({ assunto: "Assunto de teste", corpo: "Corpo da mensagem", ...corpo });
}

describe("Mensagens", () => {
  test("formando escreve à coordenação, a coordenação responde, e o formando vê a resposta", async () => {
    const { coordenador, formando } = await prepararCenarioAcademico(app);

    const envio = await enviar(formando, { destino: "COORDENACAO", assunto: "Dúvida sobre horários" });
    expect(envio.status).toBe(201);

    const recebidas = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(coordenador));
    expect(recebidas.body.data).toHaveLength(1);
    expect(recebidas.body.data[0]).toMatchObject({ assunto: "Dúvida sobre horários", lida: false });
    expect(recebidas.body.data[0].remetente.id).toBe(formando.user.id);

    const responder = await request(app)
      .patch(`/api/v1/mensagens/${envio.body.data.id}/responder`)
      .set(comToken(coordenador))
      .send({ resposta: "Já está no calendário." });
    expect(responder.status).toBe(200);
    expect(responder.body.data.lida).toBe(true);

    const segunda = await request(app)
      .patch(`/api/v1/mensagens/${envio.body.data.id}/responder`)
      .set(comToken(coordenador))
      .send({ resposta: "Outra resposta" });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe("JA_RESPONDIDA");

    const enviadas = await request(app).get("/api/v1/mensagens/enviadas").set(comToken(formando));
    expect(enviadas.body.data[0].resposta).toBe("Já está no calendário.");
  });

  test("mensagens para a assistente social chegam à coordenação", async () => {
    const { coordenador, formando } = await prepararCenarioAcademico(app);

    const envio = await enviar(formando, { destino: "ASSISTENTE_SOCIAL", assunto: "Apoio social" });
    expect(envio.status).toBe(201);

    const recebidas = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(coordenador));
    expect(recebidas.body.data).toHaveLength(1);
    expect(recebidas.body.data[0].destino).toBe("ASSISTENTE_SOCIAL");
  });

  test("formando escreve a um formador da sua turma, mas não a outro formador (403) nem sem indicar quem (422)", async () => {
    const { formador, formando } = await prepararCenarioAcademico(app);
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const destinatarios = await request(app).get("/api/v1/mensagens/destinatarios").set(comToken(formando));
    expect(destinatarios.body.data).toEqual([{ id: formador.user.id, nome: formador.user.nome }]);

    const ok = await enviar(formando, { destino: "FORMADOR", destinatarioId: formador.user.id });
    expect(ok.status).toBe(201);

    const recebidas = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(formador));
    expect(recebidas.body.data).toHaveLength(1);

    const forasteiro = await enviar(formando, { destino: "FORMADOR", destinatarioId: outroFormador.user.id });
    expect(forasteiro.status).toBe(403);
    expect(forasteiro.body.error.code).toBe("DESTINO_NAO_PERMITIDO");

    const semDestinatario = await enviar(formando, { destino: "FORMADOR" });
    expect(semDestinatario.status).toBe(422);

    const vazia = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(outroFormador));
    expect(vazia.body.data).toHaveLength(0);
  });

  test("formador só escreve à coordenação; a coordenação só escreve a formadores", async () => {
    const { coordenador, formador } = await prepararCenarioAcademico(app);

    const paraCoord = await enviar(formador, { destino: "COORDENACAO" });
    expect(paraCoord.status).toBe(201);

    const paraFormador = await enviar(formador, { destino: "FORMADOR", destinatarioId: formador.user.id });
    expect(paraFormador.status).toBe(403);

    const coordParaFormador = await enviar(coordenador, { destino: "FORMADOR", destinatarioId: formador.user.id });
    expect(coordParaFormador.status).toBe(201);

    const coordParaCoord = await enviar(coordenador, { destino: "COORDENACAO" });
    expect(coordParaCoord.status).toBe(403);

    const doFormador = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(formador));
    expect(doFormador.body.data).toHaveLength(1);
    expect(doFormador.body.data[0].remetente.id).toBe(coordenador.user.id);
  });

  test("só o destinatário marca como lida/responde; o formando não tem caixa de entrada (403)", async () => {
    const { formador, formando } = await prepararCenarioAcademico(app);
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const envio = await enviar(formando, { destino: "FORMADOR", destinatarioId: formador.user.id });
    const id = envio.body.data.id;

    const intruso = await request(app).patch(`/api/v1/mensagens/${id}/lida`).set(comToken(outroFormador));
    expect(intruso.status).toBe(404);
    expect(intruso.body.error.code).toBe("MENSAGEM_NOT_FOUND");

    const lida = await request(app).patch(`/api/v1/mensagens/${id}/lida`).set(comToken(formador));
    expect(lida.status).toBe(200);
    expect(lida.body.data.lida).toBe(true);

    const caixaFormando = await request(app).get("/api/v1/mensagens/recebidas").set(comToken(formando));
    expect(caixaFormando.status).toBe(403);

    const semToken = await request(app).get("/api/v1/mensagens/enviadas");
    expect(semToken.status).toBe(401);
  });
});
