const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "justificacoes");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

async function marcar(app, formador, aula, formando, estado) {
  return request(app)
    .put(`/api/v1/assiduidade/aula/${aula.id}`)
    .set(comToken(formador))
    .send({ presencas: [{ formandoId: formando.user.id, estado }] });
}

describe("Assiduidade", () => {
  test("formador regista presenças de uma aula já dada e vê-as na lista", async () => {
    const { formador, formando, aula } = await prepararCenarioAcademico(app, { comAula: true });

    const registarRes = await marcar(app, formador, aula, formando, "AUSENTE");
    expect(registarRes.status).toBe(200);
    expect(registarRes.body.data.formandos[0].presenca).toBe("AUSENTE");

    const corrigir = await marcar(app, formador, aula, formando, "PRESENTE");
    expect(corrigir.body.data.formandos[0].presenca).toBe("PRESENTE");

    const lista = await request(app).get(`/api/v1/assiduidade/aula/${aula.id}`).set(comToken(formador));
    expect(lista.status).toBe(200);
    expect(lista.body.data.formandos).toHaveLength(1);
    expect(lista.body.data.formandos[0].presenca).toBe("PRESENTE");
  });

  test("não se registam presenças de uma aula futura (422 AULA_FUTURA)", async () => {
    const { coordenador, formador, formando, turmaUc } = await prepararCenarioAcademico(app);

    const blocoRes = await request(app)
      .post("/api/v1/disponibilidade").set(comToken(formador))
      .send({ data: "2030-01-15", horaInicio: 10, estado: "LIVRE" });
    const aulaRes = await request(app)
      .post("/api/v1/aulas").set(comToken(coordenador))
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoRes.body.data.id, modalidade: "ONLINE" });

    const res = await marcar(app, formador, aulaRes.body.data, formando, "PRESENTE");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("AULA_FUTURA");
  });

  test("outro formador não regista presenças (403), e formandos de outra turma são recusados (422)", async () => {
    const { coordenador, formador, formando, aula } = await prepararCenarioAcademico(app, { comAula: true });
    const intruso = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });

    const res403 = await marcar(app, intruso, aula, formando, "PRESENTE");
    expect(res403.status).toBe(403);

    const outraTurma = await request(app)
      .post("/api/v1/turmas").set(comToken(coordenador))
      .send({ codigo: "T-OUTRA", designacao: "Outra", dataInicio: "2026-09-01" });
    const forasteiro = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outraTurma.body.data.id });

    const res422 = await marcar(app, formador, aula, forasteiro, "PRESENTE");
    expect(res422.status).toBe(422);
    expect(res422.body.error.code).toBe("FORMANDO_INVALIDO");

    const formandoRes = await request(app).get(`/api/v1/assiduidade/aula/${aula.id}`).set(comToken(formando));
    expect(formandoRes.status).toBe(403);
  });

  test("o formando vê o seu resumo de assiduidade", async () => {
    const { formador, formando, aula } = await prepararCenarioAcademico(app, { comAula: true });
    await marcar(app, formador, aula, formando, "AUSENTE");

    const res = await request(app).get("/api/v1/assiduidade/minhas").set(comToken(formando));
    expect(res.status).toBe(200);
    expect(res.body.data.resumo).toEqual({ aulasRegistadas: 1, presencas: 0, faltas: 1, faltasJustificadas: 0 });
    expect(res.body.data.aulas[0].presenca).toBe("AUSENTE");
    expect(res.body.data.aulas[0].uc.abreviatura).toBe("UC-ACAD");
  });

  test("ciclo da justificação: formando submete com anexo, formador aceita, o resumo conta como justificada", async () => {
    const { coordenador, formador, formando, turma, aula } = await prepararCenarioAcademico(app, { comAula: true });
    await marcar(app, formador, aula, formando, "AUSENTE");

    const submeter = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Consulta médica")
      .attach("anexo", Buffer.from("atestado"), "atestado.pdf");
    expect(submeter.status).toBe(201);
    expect(submeter.body.data.estado).toBe("PENDENTE");
    expect(submeter.body.data.temAnexo).toBe(true);
    expect(submeter.body.data.anexoUrl).toBeUndefined();
    const justificacaoId = submeter.body.data.id;

    const duplicada = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Outra vez");
    expect(duplicada.status).toBe(409);
    expect(duplicada.body.error.code).toBe("JUSTIFICACAO_JA_SUBMETIDA");

    const pendentes = await request(app).get("/api/v1/assiduidade/justificacoes?estado=PENDENTE").set(comToken(formador));
    expect(pendentes.body.data).toHaveLength(1);
    expect(pendentes.body.data[0].formando.id).toBe(formando.user.id);
    expect(pendentes.body.data[0].temAnexo).toBe(true);

    const decidir = await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${justificacaoId}/decidir`)
      .set(comToken(formador))
      .send({ estado: "ACEITE", notaDecisao: "Atestado válido" });
    expect(decidir.status).toBe(200);
    expect(decidir.body.data.estado).toBe("ACEITE");

    const decidirOutraVez = await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${justificacaoId}/decidir`)
      .set(comToken(formador))
      .send({ estado: "REJEITADA" });
    expect(decidirOutraVez.status).toBe(409);
    expect(decidirOutraVez.body.error.code).toBe("JUSTIFICACAO_JA_DECIDIDA");

    const minhas = await request(app).get("/api/v1/assiduidade/minhas").set(comToken(formando));
    expect(minhas.body.data.resumo.faltasJustificadas).toBe(1);

    const resumo = await request(app).get(`/api/v1/assiduidade/turma/${turma.id}/resumo`).set(comToken(coordenador));
    expect(resumo.status).toBe(200);
    expect(resumo.body.data.aulasDadas).toBe(1);
    expect(resumo.body.data.formandos[0]).toMatchObject({ faltas: 1, faltasJustificadas: 1, faltasInjustificadas: 0 });
  });

  test("só se justificam faltas (não presenças) e só tipos de ficheiro permitidos", async () => {
    const { formador, formando, aula } = await prepararCenarioAcademico(app, { comAula: true });

    await marcar(app, formador, aula, formando, "PRESENTE");
    const semFalta = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Estive cá");
    expect(semFalta.status).toBe(422);
    expect(semFalta.body.error.code).toBe("SEM_FALTA");

    await marcar(app, formador, aula, formando, "AUSENTE");
    const tipoInvalido = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Com executável")
      .attach("anexo", Buffer.from("MZ"), "virus.exe");
    expect(tipoInvalido.status).toBe(422);
    expect(tipoInvalido.body.error.code).toBe("TIPO_FICHEIRO_INVALIDO");
  });

  test("justificação rejeitada pode ser submetida outra vez (volta a pendente)", async () => {
    const { formador, formando, aula } = await prepararCenarioAcademico(app, { comAula: true });
    await marcar(app, formador, aula, formando, "AUSENTE");

    const primeira = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Primeira tentativa");
    await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${primeira.body.data.id}/decidir`)
      .set(comToken(formador))
      .send({ estado: "REJEITADA", notaDecisao: "Falta comprovativo" });

    const segunda = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Segunda tentativa, com comprovativo")
      .attach("anexo", Buffer.from("comprovativo"), "comprovativo.pdf");
    expect(segunda.status).toBe(201);
    expect(segunda.body.data.id).toBe(primeira.body.data.id);
    expect(segunda.body.data.estado).toBe("PENDENTE");
    expect(segunda.body.data.notaDecisao).toBeNull();
  });

  test("o anexo só é descarregável pelo formando dono, pelo formador responsável e pela coordenação", async () => {
    const { coordenador, formador, formando, turma, aula } = await prepararCenarioAcademico(app, { comAula: true });
    const colega = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: turma.id });
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    await marcar(app, formador, aula, formando, "AUSENTE");

    const submeter = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Com anexo")
      .attach("anexo", Buffer.from("conteudo"), "anexo.txt");
    const url = `/api/v1/assiduidade/justificacoes/${submeter.body.data.id}/anexo`;

    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set(comToken(colega))).status).toBe(403);
    expect((await request(app).get(url).set(comToken(outroFormador))).status).toBe(403);
    expect((await request(app).get(url).set(comToken(formando))).status).toBe(200);
    expect((await request(app).get(url).set(comToken(formador))).status).toBe(200);
    expect((await request(app).get(url).set(comToken(coordenador))).status).toBe(200);
  });
});
