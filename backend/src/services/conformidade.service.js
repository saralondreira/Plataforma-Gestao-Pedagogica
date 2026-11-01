const { hojeEmLisboa, fimDeHojeEmLisboa } = require("../lib/tempo");
const { prisma } = require("../lib/prisma");
const { notificar } = require("../lib/notificacoes");

// Conformidade automática (semáforos do estudo de caso): para cada UC de cada
// turma em curso, verifica se o formador cumpriu o que lhe cabe. Só leitura —
// calcula-se a partir de aulas, sumários e documentos que já existem.
//
//  Sumários  — aula já dada sem sumário (ou rejeitado): VERMELHO se passaram mais de
//              DIAS_TOLERANCIA_SUMARIO dias, AMARELO se é recente; sumário submetido
//              e ainda por validar: AMARELO.
//  Documentos — a UC já teve aulas mas não tem nenhum documento ativo: VERMELHO.
//  Horário   — horas da carga horária por agendar e nenhuma aula futura: AMARELO.
// O estado da UC é o pior dos três.

const DIAS_TOLERANCIA_SUMARIO = 2;
const GRAVIDADE = { VERDE: 0, AMARELO: 1, VERMELHO: 2 };

const pior = (...estados) => estados.reduce((a, b) => (GRAVIDADE[b] > GRAVIDADE[a] ? b : a), "VERDE");

function fimDeHoje() {
  return fimDeHojeEmLisboa();
}

function inicioDeHoje() {
  return hojeEmLisboa();
}

function avaliarSumarios(aulasDadas, limiteAtraso) {
  let emFalta = 0;
  let emAtraso = 0;
  let porValidar = 0;
  let validados = 0;
  for (const aula of aulasDadas) {
    const estado = aula.sumario?.estado;
    if (estado === "VALIDADO") validados += 1;
    else if (estado === "SUBMETIDO") porValidar += 1;
    else {
      emFalta += 1;
      if (aula.data < limiteAtraso) emAtraso += 1;
    }
  }
  const semaforo = emAtraso > 0 ? "VERMELHO" : emFalta > 0 || porValidar > 0 ? "AMARELO" : "VERDE";
  return { estado: semaforo, aulasDadas: aulasDadas.length, validados, porValidar, emFalta, emAtraso };
}

// `user` limita a vista: a coordenação vê tudo, o formador só as suas UCs.
async function calcular(user) {
  const hoje = inicioDeHoje();
  const limiteAtraso = new Date(hoje);
  limiteAtraso.setUTCDate(limiteAtraso.getUTCDate() - DIAS_TOLERANCIA_SUMARIO);
  const fim = fimDeHoje();

  const associacoes = await prisma.turmaUc.findMany({
    where: {
      ativo: true,
      turma: { ativo: true, estado: { not: "CONCLUIDA" } },
      ...(user.role === "FORMADOR" ? { formadorId: user.id } : {}),
    },
    select: {
      id: true,
      turmaId: true,
      turma: { select: { codigo: true } },
      uc: { select: { abreviatura: true, nome: true, cargaHoraria: true } },
      formador: { select: { id: true, nome: true } },
      aulas: { select: { data: true, duracaoHoras: true, sumario: { select: { estado: true } } } },
      documentos: { where: { ativo: true }, select: { id: true } },
    },
    orderBy: [{ turmaId: "asc" }, { id: "asc" }],
  });

  const ucs = associacoes.map((a) => {
    const aulasDadas = a.aulas.filter((aula) => aula.data <= fim);
    const sumarios = avaliarSumarios(aulasDadas, limiteAtraso);

    const documentos = { estado: aulasDadas.length > 0 && a.documentos.length === 0 ? "VERMELHO" : "VERDE", total: a.documentos.length };

    const agendadas = a.aulas.reduce((total, aula) => total + aula.duracaoHoras, 0);
    const porAgendar = Math.max(a.uc.cargaHoraria - agendadas, 0);
    const semFuturas = !a.aulas.some((aula) => aula.data >= hoje);
    const horario = { estado: porAgendar > 0 && semFuturas ? "AMARELO" : "VERDE", horasPorAgendar: porAgendar };

    return {
      turmaUcId: a.id,
      turmaId: a.turmaId,
      turma: a.turma.codigo,
      uc: a.uc.abreviatura,
      ucNome: a.uc.nome,
      formador: a.formador.nome,
      formadorId: a.formador.id,
      estado: pior(sumarios.estado, documentos.estado, horario.estado),
      sumarios,
      documentos,
      horario,
    };
  });

  const contagem = { VERDE: 0, AMARELO: 0, VERMELHO: 0 };
  ucs.forEach((u) => (contagem[u.estado] += 1));

  // Pior primeiro, para o ecrã mostrar logo o que é urgente.
  ucs.sort((x, y) => GRAVIDADE[y.estado] - GRAVIDADE[x.estado]);
  return { diasTolerancia: DIAS_TOLERANCIA_SUMARIO, total: ucs.length, verde: contagem.VERDE, amarelo: contagem.AMARELO, vermelho: contagem.VERMELHO, ucs };
}

// O que está em falta numa UC a vermelho, em linguagem que o formador percebe (sem dados de pessoas).
function motivosDaUc(u) {
  const motivos = [];
  if (u.sumarios.emAtraso > 0) motivos.push(`${u.sumarios.emAtraso} aula(s) dada(s) sem sumário há mais de ${DIAS_TOLERANCIA_SUMARIO} dias`);
  if (u.documentos.estado === "VERMELHO") motivos.push("nenhum documento enviado");
  return motivos;
}

// Coordenação: avisa por email os formadores das UCs a VERMELHO (um email por formador, com todas as suas UCs).
async function avisarFormadoresEmFalha() {
  const { ucs } = await calcular({ role: "COORDENADOR" });
  const porFormador = new Map();
  for (const u of ucs.filter((x) => x.estado === "VERMELHO")) {
    const lista = porFormador.get(u.formadorId) || [];
    lista.push(u);
    porFormador.set(u.formadorId, lista);
  }
  for (const [formadorId, lista] of porFormador) {
    await notificar([formadorId], {
      tipo: "CONFORMIDADE_EM_FALHA",
      assunto: "Há UCs tuas com documentação em falta",
      linhas: [
        "A coordenação pediu-te para regularizares o seguinte:",
        ...lista.map((u) => `- ${u.uc} (turma ${u.turma}): ${motivosDaUc(u).join("; ")}.`),
        "Consulta a página Conformidade da plataforma.",
      ],
    });
  }
  return { formadoresAvisados: porFormador.size, ucsEmFalha: [...porFormador.values()].reduce((t, l) => t + l.length, 0) };
}

module.exports = { calcular, avisarFormadoresEmFalha, DIAS_TOLERANCIA_SUMARIO };
