const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app } = require("../../src/app");
const { prisma } = require("../../src/lib/prisma");
const { testOutbox, limparTestOutbox } = require("../../src/lib/mailer");
const { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken } = require("../helpers");

const UPLOADS_TESTE = path.join(__dirname, "..", "..", "uploads-test");

beforeEach(async () => {
  await limparBaseDados();
  limparTestOutbox();
});

afterAll(async () => {
  await limparBaseDados();
  await prisma.$disconnect();
  fs.rmSync(path.join(UPLOADS_TESTE, "justificacoes"), { recursive: true, force: true });
  fs.rmSync(path.join(UPLOADS_TESTE, "trabalhos"), { recursive: true, force: true });
});

// Só interessam os emails gerados pela ação em teste, não os do cenário
// (ex.: o formador recebe um email ao ser associado à UC).
async function cenario(opcoes) {
  const c = await prepararCenarioAcademico(app, opcoes);
  limparTestOutbox();
  return c;
}

const doTipo = (tipo) => testOutbox.filter((e) => e.tipo === tipo);

describe("Notificações por email (notas, justificações, trabalhos, mensagens)", () => {
  test("lançar uma nota avisa o formando, sem revelar a nota no email", async () => {
    const { formador, formando, turmaUc } = await cenario();

    await request(app)
      .put(`/api/v1/notas/turma-uc/${turmaUc.id}/formando/${formando.user.id}`)
      .set(comToken(formador))
      .send({ valor: 14.5, observacoes: "Segredo da observação" });

    const emails = doTipo("NOTA_LANCADA");
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(formando.user.email);
    expect(emails[0].assunto).toContain("UC-ACAD");
    expect(emails[0].texto).not.toMatch(/14[.,]5/);
    expect(emails[0].texto).not.toContain("Segredo da observação");
  });

  test("justificação de falta: avisa o formador ao submeter e o formando ao ser decidida", async () => {
    const { formador, formando, aula } = await cenario({ comAula: true });

    await request(app)
      .put(`/api/v1/assiduidade/aula/${aula.id}`)
      .set(comToken(formador))
      .send({ presencas: [{ formandoId: formando.user.id, estado: "AUSENTE" }] });

    const submeter = await request(app)
      .post("/api/v1/assiduidade/justificacoes")
      .set(comToken(formando))
      .field("aulaId", String(aula.id))
      .field("motivo", "Consulta médica muito privada");
    expect(submeter.status).toBe(201);

    const aoFormador = doTipo("JUSTIFICACAO_SUBMETIDA");
    expect(aoFormador).toHaveLength(1);
    expect(aoFormador[0].to).toBe(formador.user.email);
    expect(aoFormador[0].texto).not.toContain("Consulta médica muito privada");

    await request(app)
      .patch(`/api/v1/assiduidade/justificacoes/${submeter.body.data.id}/decidir`)
      .set(comToken(formador))
      .send({ estado: "ACEITE", notaDecisao: "Nota interna" });

    const aoFormando = doTipo("JUSTIFICACAO_DECIDIDA");
    expect(aoFormando).toHaveLength(1);
    expect(aoFormando[0].to).toBe(formando.user.email);
    expect(aoFormando[0].assunto).toContain("aceite");
    expect(aoFormando[0].texto).not.toContain("Nota interna");
  });

  test("novo trabalho avisa todos os formandos da turma; avaliar só avisa se houver nota ou feedback", async () => {
    const { formador, formando, turma, turmaUc } = await cenario();
    const colega = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: turma.id });

    const trabalhoRes = await request(app)
      .post("/api/v1/trabalhos")
      .set(comToken(formador))
      .send({ turmaUcId: turmaUc.id, titulo: "Relatório final", descricao: "x", dataLimite: "2030-12-31" });
    expect(trabalhoRes.status).toBe(201);

    const novos = doTipo("TRABALHO_NOVO");
    expect(novos.map((e) => e.to).sort()).toEqual([formando.user.email, colega.user.email].sort());
    expect(novos[0].texto).toContain("2030-12-31");

    const submissao = await request(app)
      .post(`/api/v1/trabalhos/${trabalhoRes.body.data.id}/submissao`)
      .set(comToken(formando))
      .attach("ficheiro", Buffer.from("conteudo"), "trabalho.pdf");
    expect(submissao.status).toBe(201);

    limparTestOutbox();
    await request(app)
      .patch(`/api/v1/trabalhos/submissoes/${submissao.body.data.id}/avaliar`)
      .set(comToken(formador))
      .send({});
    expect(doTipo("TRABALHO_AVALIADO")).toHaveLength(0);

    await request(app)
      .patch(`/api/v1/trabalhos/submissoes/${submissao.body.data.id}/avaliar`)
      .set(comToken(formador))
      .send({ avaliacao: 16, feedback: "Muito bom" });
    const avaliados = doTipo("TRABALHO_AVALIADO");
    expect(avaliados).toHaveLength(1);
    expect(avaliados[0].to).toBe(formando.user.email);
    expect(avaliados[0].texto).not.toContain("Muito bom");
  });

  test("mensagens: avisa o destinatário ao enviar e o remetente ao ser respondida", async () => {
    const { coordenador, formador, formando } = await cenario();

    const paraCoord = await request(app)
      .post("/api/v1/mensagens")
      .set(comToken(formando))
      .send({ destino: "COORDENACAO", assunto: "Dúvida", corpo: "Texto confidencial" });
    expect(paraCoord.status).toBe(201);

    const aCoord = doTipo("MENSAGEM_NOVA");
    expect(aCoord).toHaveLength(1);
    expect(aCoord[0].to).toBe(coordenador.user.email);
    expect(aCoord[0].texto).not.toContain("Texto confidencial");

    await request(app)
      .patch(`/api/v1/mensagens/${paraCoord.body.data.id}/responder`)
      .set(comToken(coordenador))
      .send({ resposta: "Resposta confidencial" });
    const respondidas = doTipo("MENSAGEM_RESPONDIDA");
    expect(respondidas).toHaveLength(1);
    expect(respondidas[0].to).toBe(formando.user.email);
    expect(respondidas[0].texto).not.toContain("Resposta confidencial");

    limparTestOutbox();
    await request(app)
      .post("/api/v1/mensagens")
      .set(comToken(formando))
      .send({ destino: "FORMADOR", destinatarioId: formador.user.id, assunto: "Pergunta", corpo: "Corpo" });
    const aFormador = doTipo("MENSAGEM_NOVA");
    expect(aFormador).toHaveLength(1);
    expect(aFormador[0].to).toBe(formador.user.email);
  });

  test("contas inativas não recebem emails, e a operação não falha por isso", async () => {
    const { coordenador, formando } = await cenario();
    await prisma.user.create({
      data: { nome: "Coordenador Antigo", email: "antigo@teste.pt", passwordHash: "x", role: "COORDENADOR", ativo: false },
    });

    const res = await request(app)
      .post("/api/v1/mensagens")
      .set(comToken(formando))
      .send({ destino: "COORDENACAO", assunto: "Olá", corpo: "Texto" });
    expect(res.status).toBe(201);

    const destinatarios = doTipo("MENSAGEM_NOVA").map((e) => e.to);
    expect(destinatarios).toEqual([coordenador.user.email]);
  });
});
