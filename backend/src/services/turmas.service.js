const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { enviarNotificacaoMediadorAtribuido } = require("../lib/mailer");

const INCLUDE_MEDIADOR = { mediador: { select: { id: true, nome: true, sigla: true } } };

async function validarMediador(mediadorId) {
  if (mediadorId === undefined || mediadorId === null) return;
  const mediador = await prisma.user.findUnique({ where: { id: mediadorId } });
  if (!mediador || mediador.role !== "FORMADOR") {
    throw new AppError(422, "MEDIADOR_INVALIDO", "O mediador indicado não existe ou não tem o papel de Formador.");
  }
  if (!mediador.ativo) {
    throw new AppError(422, "MEDIADOR_INATIVO", "O mediador indicado está inativo.");
  }
}

// Notifica o formador por email quando é designado mediador desta turma.
// Falha silenciosamente (só regista no log) — um problema no envio de email
// nunca deve impedir a criação/edição da turma em si. O nome/email vêm de
// uma consulta dedicada em vez de alargar INCLUDE_MEDIADOR, porque esse
// "select" alimenta respostas públicas e não deve expor o email do
// mediador a quem consulta a lista de turmas.
async function notificarMediadorAtribuido(turma) {
  try {
    const mediador = await prisma.user.findUnique({
      where: { id: turma.mediadorId },
      select: { nome: true, email: true },
    });
    if (!mediador) return;
    await enviarNotificacaoMediadorAtribuido({
      nome: mediador.nome,
      email: mediador.email,
      turmaCodigo: turma.codigo,
      turmaDesignacao: turma.designacao,
    });
  } catch (erro) {
    console.error("[turmas] Falha ao enviar notificação de mediador por email:", erro.message);
  }
}

async function listar({ incluirInativos = false } = {}) {
  return prisma.turma.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { createdAt: "desc" },
    include: INCLUDE_MEDIADOR,
  });
}

async function criar(dados) {
  const existente = await prisma.turma.findUnique({ where: { codigo: dados.codigo } });
  if (existente && existente.ativo) {
    throw new AppError(409, "CODIGO_EM_USO", "Já existe uma turma com este código.");
  }
  await validarMediador(dados.mediadorId);

  // Já existiu uma turma inativa com este código — reativa-a em vez de criar
  // uma linha nova, para não perder as entregas/UCs já ligadas a esse id.
  const turma = existente
    ? await prisma.turma.update({
        where: { id: existente.id },
        data: { ...dados, ativo: true },
        include: INCLUDE_MEDIADOR,
      })
    : await prisma.turma.create({ data: dados, include: INCLUDE_MEDIADOR });

  if (dados.mediadorId) {
    await notificarMediadorAtribuido(turma); // já trata erros internamente (não falha a criação por causa do email)
  }

  return turma;
}

async function atualizar(id, dados) {
  const atual = await obterOuFalhar(id);
  await validarMediador(dados.mediadorId);
  const mediadorMudou = Boolean(dados.mediadorId) && dados.mediadorId !== atual.mediadorId;
  const turma = await prisma.turma.update({ where: { id }, data: dados, include: INCLUDE_MEDIADOR });
  if (mediadorMudou) {
    await notificarMediadorAtribuido(turma); // já trata erros internamente
  }
  return turma;
}

// Antes fazia DELETE definitivo — se a turma já tivesse entregas ou UCs
// associadas, a base de dados recusava (chave estrangeira). Agora só marca
// a turma como inativa, preservando o histórico. Ver reativar() para desfazer.
async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.turma.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  await obterOuFalhar(id);
  return prisma.turma.update({ where: { id }, data: { ativo: true }, include: INCLUDE_MEDIADOR });
}

async function obterOuFalhar(id) {
  const turma = await prisma.turma.findUnique({ where: { id } });
  if (!turma) {
    throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
  }
  return turma;
}

module.exports = { listar, criar, atualizar, apagar, reativar };
