const { fimDeHojeEmLisboa } = require("../lib/tempo");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { notificar, idsDaCoordenacao } = require("../lib/notificacoes");
const { garantirResponsavelOuCoordenador, formandoComTurma } = require("../lib/acesso");

const INCLUDE = {
  aula: {
    select: {
      id: true,
      data: true,
      horaInicio: true,
      turmaUc: {
        select: {
          id: true,
          turmaId: true,
          formadorId: true,
          uc: { select: { abreviatura: true, nome: true } },
          turma: { select: { id: true, codigo: true, mediadorId: true } },
          formador: { select: { id: true, nome: true } },
        },
      },
    },
  },
  escritoPor: { select: { id: true, nome: true } },
  validadoPor: { select: { id: true, nome: true } },
};

async function obterAulaOuFalhar(aulaId) {
  const aula = await prisma.aula.findUnique({
    where: { id: aulaId },
    include: { turmaUc: { include: { uc: true, turma: true } } },
  });
  if (!aula) {
    throw new AppError(404, "AULA_NOT_FOUND", "Aula não encontrada.");
  }
  return aula;
}

// Quem valida os sumários de uma turma: o mediador responsável ou a coordenação.
function podeValidar(user, turma) {
  return user.role === "COORDENADOR" || (user.role === "FORMADOR" && turma.mediadorId === user.id);
}

// "Hoje" incluído: o formador pode escrever o sumário no próprio dia da aula.
function fimDeHoje() {
  return fimDeHojeEmLisboa();
}

// Se o mediador é o próprio autor do sumário, não se valida a si mesmo: segue para a coordenação.
async function destinatariosDeValidacao(turma, autorId) {
  return turma.mediadorId && turma.mediadorId !== autorId ? [turma.mediadorId] : idsDaCoordenacao();
}

// O formador responsável escreve (ou corrige) o sumário de uma aula já dada.
async function registar(user, aulaId, texto) {
  const aula = await obterAulaOuFalhar(aulaId);
  garantirResponsavelOuCoordenador(user, aula.turmaUc);
  if (aula.data > fimDeHoje()) {
    throw new AppError(422, "AULA_FUTURA", "Esta aula ainda não aconteceu — o sumário escreve-se no dia da aula ou depois.");
  }

  const existente = await prisma.sumario.findUnique({ where: { aulaId } });
  if (existente && existente.estado === "VALIDADO") {
    throw new AppError(409, "SUMARIO_VALIDADO", "Este sumário já foi validado e não pode ser alterado.");
  }

  const sumario = await prisma.sumario.upsert({
    where: { aulaId },
    update: { texto, estado: "SUBMETIDO", escritoPorId: user.id, validadoPorId: null, validadoEm: null, notaValidacao: null },
    create: { aulaId, texto, escritoPorId: user.id },
    include: INCLUDE,
  });

  await notificar(await destinatariosDeValidacao(aula.turmaUc.turma, user.id), {
    tipo: "SUMARIO_SUBMETIDO",
    assunto: `Sumário por validar — ${aula.turmaUc.uc.abreviatura}`,
    linhas: [`Foi submetido um sumário de ${aula.turmaUc.uc.abreviatura} (turma ${aula.turmaUc.turma.codigo}) que aguarda a tua validação.`, "Consulta-o na plataforma."],
  });

  return sumario;
}

// O sumário de uma aula (ou null) — para quem o escreve ou valida.
async function daAula(user, aulaId) {
  const aula = await obterAulaOuFalhar(aulaId);
  if (!podeValidar(user, aula.turmaUc.turma)) garantirResponsavelOuCoordenador(user, aula.turmaUc);
  return prisma.sumario.findUnique({ where: { aulaId }, include: INCLUDE });
}

async function decidir(user, sumarioId, { aceite, nota }) {
  const sumario = await prisma.sumario.findUnique({ where: { id: sumarioId }, include: INCLUDE });
  if (!sumario) {
    throw new AppError(404, "SUMARIO_NOT_FOUND", "Sumário não encontrado.");
  }
  if (!podeValidar(user, sumario.aula.turmaUc.turma)) {
    throw new AppError(403, "FORBIDDEN", "Só o mediador da turma (ou a coordenação) pode validar sumários.");
  }
  // Um formador (mediador) nunca valida o seu próprio sumário; a coordenação pode sempre.
  if (user.role === "FORMADOR" && sumario.escritoPorId === user.id) {
    throw new AppError(403, "FORBIDDEN", "Não podes validar o teu próprio sumário — fica para a coordenação.");
  }
  if (sumario.estado !== "SUBMETIDO") {
    throw new AppError(409, "SUMARIO_JA_DECIDIDO", "Este sumário já foi decidido — o formador tem de o voltar a submeter para nova validação.");
  }
  if (!aceite && !(nota && nota.trim())) {
    throw new AppError(422, "NOTA_OBRIGATORIA", "Indica o motivo da rejeição, para o formador saber o que corrigir.");
  }

  // Só decide se o sumário continuar SUBMETIDO (duas decisões em simultâneo: ganha uma).
  const { count } = await prisma.sumario.updateMany({
    where: { id: sumarioId, estado: "SUBMETIDO" },
    data: { estado: aceite ? "VALIDADO" : "REJEITADO", validadoPorId: user.id, validadoEm: new Date(), notaValidacao: nota?.trim() || null },
  });
  if (count !== 1) {
    throw new AppError(409, "SUMARIO_JA_DECIDIDO", "Este sumário já foi decidido — o formador tem de o voltar a submeter para nova validação.");
  }
  const atualizado = await prisma.sumario.findUnique({ where: { id: sumarioId }, include: INCLUDE });

  await notificar([sumario.escritoPorId], {
    tipo: aceite ? "SUMARIO_VALIDADO" : "SUMARIO_REJEITADO",
    assunto: `Sumário ${aceite ? "validado" : "rejeitado"} — ${sumario.aula.turmaUc.uc.abreviatura}`,
    linhas: [`O teu sumário de ${sumario.aula.turmaUc.uc.abreviatura} (turma ${sumario.aula.turmaUc.turma.codigo}) foi ${aceite ? "validado" : "rejeitado"}.`, aceite ? "Consulta-o na plataforma." : "Abre-o na plataforma, corrige-o e volta a submetê-lo."],
  });

  return atualizado;
}

// Sumários à espera de decisão: a coordenação vê todos; um mediador só os das suas turmas.
async function porValidar(user) {
  return prisma.sumario.findMany({
    where: {
      estado: "SUBMETIDO",
      // O mediador não vê os seus próprios sumários (não os pode validar).
      ...(user.role === "COORDENADOR" ? {} : { escritoPorId: { not: user.id } }),
      aula: { turmaUc: { ativo: true, turma: { ativo: true, ...(user.role === "COORDENADOR" ? {} : { mediadorId: user.id }) } } },
    },
    include: INCLUDE,
    orderBy: { updatedAt: "asc" },
  });
}

// Aulas já dadas do formador sem sumário (ou com o sumário rejeitado).
async function porEscrever(user) {
  const aulas = await prisma.aula.findMany({
    where: {
      data: { lte: fimDeHoje() },
      turmaUc: { formadorId: user.id, ativo: true },
      OR: [{ sumario: null }, { sumario: { estado: "REJEITADO" } }],
    },
    select: {
      id: true,
      data: true,
      horaInicio: true,
      turmaUc: { select: { uc: { select: { abreviatura: true, nome: true } }, turma: { select: { codigo: true } } } },
      sumario: { select: { id: true, estado: true, texto: true, notaValidacao: true } },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    take: 100,
  });
  return aulas;
}

async function doFormador(user) {
  return prisma.sumario.findMany({
    where: { escritoPorId: user.id },
    include: INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

// O formando consulta os sumários **validados** da sua turma.
async function daTurmaDoFormando(user) {
  const formando = await formandoComTurma(user.id);
  return prisma.sumario.findMany({
    where: { estado: "VALIDADO", aula: { turmaUc: { turmaId: formando.turmaId, ativo: true } } },
    include: INCLUDE,
    orderBy: [{ aula: { data: "desc" } }, { aula: { horaInicio: "desc" } }],
    take: 200,
  });
}

module.exports = { registar, daAula, decidir, porValidar, porEscrever, doFormador, daTurmaDoFormando };
