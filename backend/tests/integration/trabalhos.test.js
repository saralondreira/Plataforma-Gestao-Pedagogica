const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

const PASTA_UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test", "trabalhos");

beforeEach(async () => {
  await limparBaseDados();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(PASTA_UPLOADS_TESTE, { recursive: true, force: true });
});

async function criarTrabalho(formador, turmaUc, extra = {}) {
  return request(app)
    .post("/api/v1/trabalhos")
    .set(comToken(formador))
    .send({ turmaUcId: turmaUc.id, titulo: "Relatório final", descricao: "Entregar em PDF", dataLimite: "2030-12-31", ...extra });
}

function submeter(formando, trabalho, conteudo = "versao 1", nome = "trabalho.pdf") {
  return request(app)
    .post(`/api/v1/trabalhos/${trabalho.id}/submissao`)
    .set(comToken(formando))
    .field("comentario", "Segue o trabalho")
    .attach("ficheiro", Buffer.from(conteudo), nome);
}

describe("Trabalhos", () => {
  test("formador atribui um trabalho; o formando vê-o, mas não pode criar (403)", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);

    const criarRes = await criarTrabalho(formador, turmaUc);
    expect(criarRes.status).toBe(201);
    expect(criarRes.body.data.titulo).toBe("Relatório final");

    const minhas = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    expect(minhas.status).toBe(200);
    expect(minhas.body.data).toHaveLength(1);
    expect(minhas.body.data[0]).toMatchObject({ titulo: "Relatório final", prazoTerminado: false, submissao: null });
    expect(minhas.body.data[0].uc.abreviatura).toBe("UC-ACAD");

    const formandoCria = await criarTrabalho(formando, turmaUc);
    expect(formandoCria.status).toBe(403);

    const intruso = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const intrusoCria = await criarTrabalho(intruso, turmaUc);
    expect(intrusoCria.status).toBe(403);

    const lista = await request(app).get(`/api/v1/trabalhos/turma-uc/${turmaUc.id}`).set(comToken(formador));
    expect(lista.body.data).toHaveLength(1);
    expect(lista.body.data[0]).toMatchObject({ totalSubmissoes: 0, totalFormandos: 1 });
  });

  test("formando submete, o formador avalia, e reenviar substitui o ficheiro e apaga a avaliação", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);
    const trabalho = (await criarTrabalho(formador, turmaUc)).body.data;

    const primeira = await submeter(formando, trabalho);
    expect(primeira.status).toBe(201);
    expect(primeira.body.data.ficheiroUrl).toBeUndefined();

    const submissoes = await request(app).get(`/api/v1/trabalhos/${trabalho.id}/submissoes`).set(comToken(formador));
    expect(submissoes.status).toBe(200);
    expect(submissoes.body.data.formandos[0].submissao.id).toBe(primeira.body.data.id);

    const avaliar = await request(app)
      .patch(`/api/v1/trabalhos/submissoes/${primeira.body.data.id}/avaliar`)
      .set(comToken(formador))
      .send({ avaliacao: 15, feedback: "Bom, falta conclusão" });
    expect(avaliar.status).toBe(200);

    const minhas = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    expect(minhas.body.data[0].submissao).toMatchObject({ avaliacao: 15, feedback: "Bom, falta conclusão" });

    const reenvio = await submeter(formando, trabalho, "versao 2", "trabalho-v2.pdf");
    expect(reenvio.status).toBe(201);
    expect(reenvio.body.data.id).toBe(primeira.body.data.id);

    const depois = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    expect(depois.body.data[0].submissao.avaliacao).toBeNull();
    expect(depois.body.data[0].submissao.feedback).toBeNull();
  });

  test("fora do prazo (409 PRAZO_ULTRAPASSADO), sem ficheiro (422) e com tipo inválido (422)", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);

    const expirado = (await criarTrabalho(formador, turmaUc, { dataLimite: "2026-01-01" })).body.data;
    const foraDoPrazo = await submeter(formando, expirado);
    expect(foraDoPrazo.status).toBe(409);
    expect(foraDoPrazo.body.error.code).toBe("PRAZO_ULTRAPASSADO");

    const aberto = (await criarTrabalho(formador, turmaUc, { titulo: "Outro trabalho" })).body.data;

    const semFicheiro = await request(app)
      .post(`/api/v1/trabalhos/${aberto.id}/submissao`)
      .set(comToken(formando))
      .field("comentario", "Esqueci-me do ficheiro");
    expect(semFicheiro.status).toBe(422);

    const tipoInvalido = await submeter(formando, aberto, "MZ", "programa.exe");
    expect(tipoInvalido.status).toBe(422);
    expect(tipoInvalido.body.error.code).toBe("TIPO_FICHEIRO_INVALIDO");
  });

  test("um formando de outra turma não submete (403) e o formador não submete (403)", async () => {
    const { coordenador, formador, turmaUc } = await prepararCenarioAcademico(app);
    const trabalho = (await criarTrabalho(formador, turmaUc)).body.data;

    const outraTurma = await request(app)
      .post("/api/v1/turmas").set(comToken(coordenador))
      .send({ codigo: "T-OUTRA", designacao: "Outra", dataInicio: "2026-09-01" });
    const forasteiro = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: outraTurma.body.data.id });

    const res = await submeter(forasteiro, trabalho);
    expect(res.status).toBe(403);

    const formadorSubmete = await submeter(formador, trabalho);
    expect(formadorSubmete.status).toBe(403);
  });

  test("o ficheiro submetido só é descarregável pelo dono, pelo formador responsável e pela coordenação", async () => {
    const { coordenador, formador, formando, turma, turmaUc } = await prepararCenarioAcademico(app);
    const colega = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: turma.id });
    const outroFormador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
    const trabalho = (await criarTrabalho(formador, turmaUc)).body.data;
    const submissao = (await submeter(formando, trabalho)).body.data;
    const url = `/api/v1/trabalhos/submissoes/${submissao.id}/ficheiro`;

    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set(comToken(colega))).status).toBe(403);
    expect((await request(app).get(url).set(comToken(outroFormador))).status).toBe(403);
    expect((await request(app).get(url).set(comToken(formando))).status).toBe(200);
    expect((await request(app).get(url).set(comToken(formador))).status).toBe(200);
    expect((await request(app).get(url).set(comToken(coordenador))).status).toBe(200);
  });

  test("editar e apagar (desativar) um trabalho; o apagado desaparece das listagens", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);
    const trabalho = (await criarTrabalho(formador, turmaUc)).body.data;

    const editar = await request(app)
      .patch(`/api/v1/trabalhos/${trabalho.id}`)
      .set(comToken(formador))
      .send({ titulo: "Relatório final (revisto)" });
    expect(editar.status).toBe(200);
    expect(editar.body.data.titulo).toBe("Relatório final (revisto)");

    const apagar = await request(app).delete(`/api/v1/trabalhos/${trabalho.id}`).set(comToken(formador));
    expect(apagar.status).toBe(204);

    const lista = await request(app).get(`/api/v1/trabalhos/turma-uc/${turmaUc.id}`).set(comToken(formador));
    expect(lista.body.data).toHaveLength(0);
    const minhas = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    expect(minhas.body.data).toHaveLength(0);
  });

  test("avaliar uma submissão não altera a data de envio (enviadaEm)", async () => {
    const { formador, formando, turmaUc } = await prepararCenarioAcademico(app);
    const trabalho = (await criarTrabalho(formador, turmaUc)).body.data;
    const submissao = (await submeter(formando, trabalho)).body.data;

    const antes = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    const enviadaAntes = antes.body.data[0].submissao.enviadaEm;

    await new Promise((resolve) => setTimeout(resolve, 1100)); // MySQL guarda segundos
    await request(app)
      .patch(`/api/v1/trabalhos/submissoes/${submissao.id}/avaliar`)
      .set(comToken(formador))
      .send({ avaliacao: 12, feedback: "Ok" });

    const depois = await request(app).get("/api/v1/trabalhos/minhas").set(comToken(formando));
    expect(depois.body.data[0].submissao.avaliacao).toBe(12);
    expect(depois.body.data[0].submissao.enviadaEm).toBe(enviadaAntes);
  });
});
