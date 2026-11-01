const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { bloquear } = require("../lib/bloqueios");

// Redefinir um bloco (upsert) marca-o sempre como ativo — é assim que um
// bloco previamente "apagado" (inativo) volta a ficar disponível, sem
// precisar de um endpoint de reativar à parte.
async function definirBloco(formadorId, dados) {
  // Um bloco com aula agendada não pode ter o estado mudado por aqui (ex.:
  // marcar como BLOQUEADO) — isso deixaria a aula ligada a um bloco
  // inconsistente. apagar() já tinha esta proteção; faltava aqui.
  const existente = await prisma.disponibilidade.findUnique({
    where: {
      formadorId_data_horaInicio: { formadorId, data: dados.data, horaInicio: dados.horaInicio },
    },
    include: { aula: true },
  });
  if (existente?.aula) {
    throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada — cancela a aula primeiro.");
  }

  return prisma.$transaction(async (tx) => {
    // Se o bloco está a ser agendado neste momento, espera e vê a aula já gravada.
    if (existente) {
      await bloquear(tx, "disponibilidades", existente.id);
      const atual = await tx.disponibilidade.findUnique({ where: { id: existente.id }, include: { aula: true } });
      if (atual.aula) {
        throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada — cancela a aula primeiro.");
      }
    }
    return tx.disponibilidade.upsert({
      where: {
        formadorId_data_horaInicio: { formadorId, data: dados.data, horaInicio: dados.horaInicio },
      },
      update: { estado: dados.estado, motivo: dados.motivo ?? null, ativo: true },
      create: { formadorId, data: dados.data, horaInicio: dados.horaInicio, estado: dados.estado, motivo: dados.motivo ?? null },
    });
  });
}

async function listarPorFormador(formadorId, { de, ate, incluirInativos = false } = {}) {
  return prisma.disponibilidade.findMany({
    where: {
      formadorId,
      ...(incluirInativos ? {} : { ativo: true }),
      ...(de || ate ? { data: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}),
    },
    include: {
      aula: {
        select: {
          id: true,
          turmaUcId: true,
          modalidade: true,
          turmaUc: { select: { uc: { select: { abreviatura: true, nome: true } }, turma: { select: { codigo: true } } } },
        },
      },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });
}

async function obterOuFalhar(id) {
  const bloco = await prisma.disponibilidade.findUnique({ where: { id }, include: { aula: true } });
  if (!bloco) {
    throw new AppError(404, "BLOCO_NOT_FOUND", "Bloco de disponibilidade não encontrado.");
  }
  return bloco;
}

// Continua a recusar apagar um bloco com aula agendada — aqui o motivo não é
// evitar um DELETE a falhar, é uma regra de agenda: não faz sentido libertar
// um bloco que já tem uma aula marcada sem cancelar essa aula primeiro.
async function apagar(id, formadorId) {
  const bloco = await obterOuFalhar(id);
  if (bloco.formadorId !== formadorId) {
    throw new AppError(403, "FORBIDDEN", "Só podes apagar blocos da tua própria disponibilidade.");
  }
  if (bloco.aula) {
    throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada — cancela a aula primeiro.");
  }
  await prisma.$transaction(async (tx) => {
    await bloquear(tx, "disponibilidades", id);
    const atual = await tx.disponibilidade.findUnique({ where: { id }, include: { aula: true } });
    if (atual.aula) {
      throw new AppError(409, "BLOCO_OCUPADO", "Este bloco já tem uma aula agendada — cancela a aula primeiro.");
    }
    await tx.disponibilidade.update({ where: { id }, data: { ativo: false } });
  });
}

// A coordenação pede a um formador que marque disponibilidade em horas
// concretas (ex.: depois de "repetir semana" falhar por falta de blocos).
// Email curto com as datas/horas e a indicação de abrir "A Minha Agenda" —
// nada sensível. Nunca falha o pedido por causa do email (ver notificacoes.js).
async function pedirMarcacao(formadorId, quando) {
  const formador = await prisma.user.findUnique({ where: { id: formadorId } });
  if (!formador || formador.role !== "FORMADOR" || !formador.ativo) {
    throw new AppError(404, "FORMADOR_NOT_FOUND", "Formador não encontrado ou inativo.");
  }
  const { notificar } = require("../lib/notificacoes");
  await notificar([formadorId], {
    tipo: "DISPONIBILIDADE_PEDIDA",
    assunto: "A coordenação pede que marques disponibilidade",
    linhas: [
      `Falta-te marcar disponibilidade para ${quando.length} aula(s) que a coordenação quer agendar:`,
      ...quando.slice(0, 20).map((q) => `• ${q}`),
      ...(quando.length > 20 ? [`… e mais ${quando.length - 20}.`] : []),
      "Abre \"A Minha Agenda\" na plataforma e marca essas horas como livres.",
    ],
  });
  return { avisados: 1, horas: quando.length };
}

module.exports = { pedirMarcacao, definirBloco, listarPorFormador, obterOuFalhar, apagar };
