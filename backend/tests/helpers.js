const request = require("supertest");
const bcrypt = require("bcrypt");
const { prisma } = require("../src/lib/prisma");

const SALT_ROUNDS = 10; // tem de ser igual ao usado em src/services/auth.service.js

// Ordem importa por causa das foreign keys: dependentes antes de turmas/users.
async function limparBaseDados() {
  await prisma.mensagem.deleteMany();
  await prisma.submissaoTrabalho.deleteMany();
  await prisma.trabalho.deleteMany();
  await prisma.justificacao.deleteMany();
  await prisma.presenca.deleteMany();
  await prisma.notaHistorico.deleteMany();
  await prisma.nota.deleteMany();
  await prisma.sumario.deleteMany();
  await prisma.comunicado.deleteMany();
  await prisma.documentoUc.deleteMany();
  await prisma.aula.deleteMany();
  await prisma.disponibilidade.deleteMany();
  await prisma.turmaUc.deleteMany();
  await prisma.uc.deleteMany();
  await prisma.entrega.deleteMany();
  await prisma.pedidoAcesso.deleteMany();
  await prisma.turma.deleteMany();
  await prisma.user.deleteMany();
}

let contador = 0;

// Cria o utilizador de teste diretamente na base de dados (via Prisma), em
// vez de passar por POST /auth/register — essa rota passou a exigir um
// coordenador autenticado (ver PLANEAMENTO.md, "Auditoria de rotas e
// permissões", 2026-09-09), por isso já não serve para criar o primeiro
// utilizador de cada teste. O login continua a passar pela API a sério, para
// os testes continuarem a validar esse fluxo de ponta a ponta.
async function criarUtilizadorAutenticado(app, { role = "COORDENADOR", nome, email, password = "Teste123!", turmaId } = {}) {
  contador += 1;
  nome = nome || `Utilizador Teste ${contador}`;
  email = email || `utilizador${contador}@teste.pt`;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userCriado = await prisma.user.create({
    data: { nome, email, passwordHash, role, ...(turmaId ? { turmaId } : {}) },
  });
  const { passwordHash: _omitido, ...user } = userCriado;

  const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password });

  return { token: loginRes.body.data.token, user };
}


// Cenário comum às funcionalidades de formando/formador (notas, assiduidade,
// trabalhos, mensagens): coordenação, um formador responsável por uma UC numa
// turma, e um formando dessa turma. Com `comAula`, agenda também uma aula já
// passada (2026-09-10) — necessária para registar presenças.
async function prepararCenarioAcademico(app, { comAula = false } = {}) {
  const coordenador = await criarUtilizadorAutenticado(app, { role: "COORDENADOR" });
  const formador = await criarUtilizadorAutenticado(app, { role: "FORMADOR" });
  const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

  const turmaRes = await request(app)
    .post("/api/v1/turmas").set(auth(coordenador))
    .send({ codigo: "T-ACAD", designacao: "Turma Académica", dataInicio: "2026-09-01" });
  const ucRes = await request(app)
    .post("/api/v1/ucs").set(auth(coordenador))
    .send({ abreviatura: "UC-ACAD", nome: "UC Académica", cargaHoraria: 50 });
  const turmaUcRes = await request(app)
    .post("/api/v1/turma-ucs").set(auth(coordenador))
    .send({ turmaId: turmaRes.body.data.id, ucId: ucRes.body.data.id, formadorId: formador.user.id });

  const turma = turmaRes.body.data;
  const turmaUc = turmaUcRes.body.data;
  const formando = await criarUtilizadorAutenticado(app, { role: "FORMANDO", turmaId: turma.id });

  let aula = null;
  if (comAula) {
    const blocoRes = await request(app)
      .post("/api/v1/disponibilidade").set(auth(formador))
      .send({ data: "2026-09-10", horaInicio: 9, estado: "LIVRE" });
    const aulaRes = await request(app)
      .post("/api/v1/aulas").set(auth(coordenador))
      .send({ turmaUcId: turmaUc.id, disponibilidadeId: blocoRes.body.data.id, modalidade: "PRESENCIAL" });
    aula = aulaRes.body.data;
  }

  return { coordenador, formador, formando, turma, turmaUc, aula };
}

// Cabeçalho Authorization para um utilizador devolvido por criarUtilizadorAutenticado.
function comToken(utilizador) {
  return { Authorization: `Bearer ${utilizador.token}` };
}

module.exports = { limparBaseDados, criarUtilizadorAutenticado, prepararCenarioAcademico, comToken };
