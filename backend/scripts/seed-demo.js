// Dados de demonstração: uma turma em curso com coordenador, mediador, formadores
// e formandos, e um pouco de tudo (aulas dadas e futuras, presenças, notas,
// sumários em todos os estados, documentos, um trabalho e uma mensagem) — o
// suficiente para mostrar os semáforos de conformidade e os dashboards.
//
// Uso (a partir da pasta backend/):
//   npm run seed                 -> só corre numa base de dados SEM utilizadores
//   npm run seed -- --forcar     -> acrescenta mesmo que já haja utilizadores (dados de demo
//                                   duplicam-se se já existirem: falha no email repetido)
// Todas as contas de demonstração têm a mesma palavra-passe (abaixo). Nunca
// corre com NODE_ENV=production.

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { prisma } = require("../src/lib/prisma");
const { UPLOADS_DIR } = require("../src/config/paths");

const SALT_ROUNDS = 10; // tem de ser igual ao usado em src/services/auth.service.js
const PASSWORD_DEMO = "Demo1234!";
const EMAIL = (nome) => `${nome}@demo.pt`;

// Meia-noite UTC de hoje + n dias (Aula.data e Disponibilidade.data são "só dia").
function dia(deslocamento) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d;
}

async function semear(db = prisma) {
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, SALT_ROUNDS);
  const criarUser = (nome, email, role, extra = {}) => db.user.create({ data: { nome, email, passwordHash, role, ...extra } });

  const coordenador = await criarUser("Carla Coordenadora", EMAIL("coordenador"), "COORDENADOR");
  const [fMedia, fBackend, fFrontend] = await Promise.all([
    criarUser("Marta Mediadora", EMAIL("mediadora"), "FORMADOR", { sigla: "MM", estadoFormador: "ATIVO" }),
    criarUser("Bruno Backend", EMAIL("bruno"), "FORMADOR", { sigla: "BB", estadoFormador: "ATIVO" }),
    criarUser("Filipa Frontend", EMAIL("filipa"), "FORMADOR", { sigla: "FF", estadoFormador: "ATIVO" }),
  ]);

  const turma = await db.turma.create({
    data: {
      codigo: "TPSI-DEMO",
      designacao: "Técnico de Programação de Sistemas de Informação (demo)",
      dataInicio: dia(-30),
      estado: "EM_CURSO",
      idCursoIEFP: "IEFP-2026-001",
      mediadorId: fMedia.id,
    },
  });

  const nomes = ["Ana Silva", "Rui Costa", "Inês Pereira", "Tiago Santos", "Beatriz Lopes", "Diogo Ferreira"];
  const formandos = [];
  for (const [i, nome] of nomes.entries()) {
    formandos.push(await criarUser(nome, EMAIL(`formando${i + 1}`), "FORMANDO", { turmaId: turma.id }));
  }

  const catalogo = [
    { abreviatura: "UC00604", nome: "Desenvolvimento Frontend", cargaHoraria: 50, formador: fFrontend, hora: 8 },
    { abreviatura: "UC00605", nome: "Desenvolvimento Backend", cargaHoraria: 50, formador: fBackend, hora: 9 },
    { abreviatura: "UC00614", nome: "Integração e Deploy", cargaHoraria: 25, formador: fMedia, hora: 10 },
  ];
  const ucs = [];
  for (const c of catalogo) {
    const uc = await db.uc.create({ data: { abreviatura: c.abreviatura, nome: c.nome, cargaHoraria: c.cargaHoraria } });
    const turmaUc = await db.turmaUc.create({ data: { turmaId: turma.id, ucId: uc.id, formadorId: c.formador.id } });
    const aulas = {};
    for (const [rotulo, deslocamento] of [["dada1", -10], ["dada2", -6], ["futura1", 3], ["futura2", 7]]) {
      const data = dia(deslocamento);
      const bloco = await db.disponibilidade.create({ data: { formadorId: c.formador.id, data, horaInicio: c.hora, estado: "LIVRE" } });
      aulas[rotulo] = await db.aula.create({
        data: { turmaUcId: turmaUc.id, disponibilidadeId: bloco.id, data, horaInicio: c.hora, duracaoHoras: 1, modalidade: rotulo.endsWith("2") ? "ONLINE" : "PRESENCIAL" },
      });
    }
    ucs.push({ ...c, uc, turmaUc, aulas });
  }
  const [frontend, backend, integracao] = ucs;

  // Segunda turma com a MESMA UC de Backend, dada por outra formadora: mostra que a mesma UC
  // pode ter formadores e turmas diferentes (TurmaUc). Tem dois formandos e uma aula futura.
  const turmaB = await db.turma.create({
    data: { codigo: "TPSI-DEMO-B", designacao: "Segunda turma (demo)", dataInicio: dia(-7), estado: "EM_CURSO", idCursoIEFP: "IEFP-2026-002" },
  });
  const turmaUcB = await db.turmaUc.create({ data: { turmaId: turmaB.id, ucId: backend.uc.id, formadorId: fFrontend.id } });
  const blocoB = await db.disponibilidade.create({ data: { formadorId: fFrontend.id, data: dia(4), horaInicio: 8, estado: "LIVRE" } });
  await db.aula.create({ data: { turmaUcId: turmaUcB.id, disponibilidadeId: blocoB.id, data: dia(4), horaInicio: 8, duracaoHoras: 1, modalidade: "PRESENCIAL" } });
  await criarUser("Joana Pires", EMAIL("formando7"), "FORMANDO", { turmaId: turmaB.id });
  await criarUser("Marco Dias", EMAIL("formando8"), "FORMANDO", { turmaId: turmaB.id });

  // Presenças nas aulas dadas: todos presentes, exceto o Rui (3 faltas injustificadas → "em risco")
  // e a Inês (1 falta com justificação pendente).
  const [, rui, ines] = formandos;
  for (const u of ucs) {
    for (const aula of [u.aulas.dada1, u.aulas.dada2]) {
      for (const f of formandos) {
        const ausente = (f.id === rui.id && (u === frontend || (u === backend && aula === u.aulas.dada1))) || (f.id === ines.id && u === frontend && aula === u.aulas.dada1);
        await db.presenca.create({ data: { aulaId: aula.id, formandoId: f.id, estado: ausente ? "AUSENTE" : "PRESENTE" } });
      }
    }
  }
  await db.justificacao.create({ data: { aulaId: frontend.aulas.dada1.id, formandoId: ines.id, motivo: "Consulta médica marcada há meses.", estado: "PENDENTE" } });

  // Notas de Frontend para toda a turma.
  for (const [i, f] of formandos.entries()) {
    await db.nota.create({ data: { turmaUcId: frontend.turmaUc.id, formandoId: f.id, valor: 12 + i, lancadaPorId: frontend.formador.id } });
  }

  // Sumários: Frontend tudo validado (verde); Backend com um submetido e outro em falta (vermelho);
  // Integração com um rejeitado.
  const sumario = (u, aula, estado, extra = {}) =>
    db.sumario.create({
      data: {
        aulaId: aula.id,
        texto: `Aula de ${u.nome}: conteúdos, exercícios práticos e trabalho para casa.`,
        estado,
        escritoPorId: u.formador.id,
        ...extra,
      },
    });
  const validado = { validadoPorId: fMedia.id, validadoEm: new Date() };
  await sumario(frontend, frontend.aulas.dada1, "VALIDADO", validado);
  await sumario(frontend, frontend.aulas.dada2, "VALIDADO", validado);
  await sumario(backend, backend.aulas.dada1, "SUBMETIDO");
  await sumario(integracao, integracao.aulas.dada1, "REJEITADO", { validadoPorId: coordenador.id, validadoEm: new Date(), notaValidacao: "Falta indicar os exercícios realizados." });

  // Documentos: Frontend e Integração têm; Backend não (→ vermelho). Um ficheiro real em disco.
  for (const u of [frontend, integracao]) {
    const interno = `${Date.now()}-${u.formador.id}-demo.txt`;
    const pasta = path.join(UPLOADS_DIR, "documentos", String(u.turmaUc.id));
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, interno), `Documento de demonstração — ${u.nome}\n`);
    await db.documentoUc.create({
      data: {
        turmaUcId: u.turmaUc.id,
        nomePadrao: `IEFP-2026-001_${u.abreviatura}_${new Date().toISOString().slice(0, 10)}.txt`,
        nomeOriginal: "apontamentos.txt",
        ficheiro: interno,
        tamanho: 40,
        enviadoPorId: u.formador.id,
      },
    });
  }

  await db.trabalho.create({
    data: { turmaUcId: frontend.turmaUc.id, titulo: "Página de apresentação pessoal", descricao: "HTML e CSS semânticos, responsivo.", dataLimite: dia(5), criadoPorId: frontend.formador.id },
  });
  await db.mensagem.create({
    data: { remetenteId: formandos[0].id, destino: "COORDENACAO", assunto: "Dúvida sobre o calendário", corpo: "Boa tarde, a aula de dia 12 mantém-se?" },
  });

  return { turma, coordenador, formadores: [fMedia, fBackend, fFrontend], formandos, passwordDemo: PASSWORD_DEMO };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Recusado: não se semeiam dados de demonstração em produção.");
    process.exit(1);
  }
  const existentes = await prisma.user.count();
  if (existentes > 0 && !process.argv.includes("--forcar")) {
    console.error(`A base de dados já tem ${existentes} utilizador(es). Para acrescentar mesmo assim: npm run seed -- --forcar`);
    process.exit(1);
  }
  const r = await semear();
  console.log("Dados de demonstração criados.");
  console.log(`Palavra-passe de todas as contas: ${r.passwordDemo}`);
  console.log(`  Coordenação: ${r.coordenador.email}`);
  console.log(`  Formadores:  ${r.formadores.map((f) => f.email).join(", ")} (a primeira é mediadora)`);
  console.log(`  Formandos:   ${r.formandos.map((f) => f.email).join(", ")}`);
  console.log(`  Segunda turma (TPSI-DEMO-B, mesma UC de Backend com outra formadora): ${EMAIL("formando7")}, ${EMAIL("formando8")}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Erro ao semear:", error.message);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { semear, PASSWORD_DEMO };
