const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { enviarCredenciaisAcesso } = require("../lib/mailer");

const SALT_ROUNDS = 10;

const INCLUDE_TURMA_DECIDIDA = {
  turmaDecidida: { select: { id: true, codigo: true, designacao: true } },
};

async function criar(dados) {
  return prisma.pedidoAcesso.create({ data: dados });
}

async function listar() {
  return prisma.pedidoAcesso.findMany({
    orderBy: { createdAt: "desc" },
    include: INCLUDE_TURMA_DECIDIDA,
  });
}

function gerarPasswordTemporaria() {
  // ~12 caracteres, legível o suficiente para copiar/comunicar manualmente.
  return crypto.randomBytes(9).toString("base64url");
}

async function obterOuFalhar(id) {
  const pedido = await prisma.pedidoAcesso.findUnique({ where: { id } });
  if (!pedido) {
    throw new AppError(404, "PEDIDO_NOT_FOUND", "Pedido de acesso não encontrado.");
  }
  return pedido;
}

async function obterPendenteOuFalhar(id) {
  const pedido = await obterOuFalhar(id);
  if (pedido.estado !== "PENDENTE") {
    throw new AppError(409, "PEDIDO_JA_TRATADO", "Este pedido já foi aprovado ou rejeitado.");
  }
  return pedido;
}

async function obterAAguardarRhOuFalhar(id) {
  const pedido = await obterOuFalhar(id);
  if (pedido.estado !== "A_AGUARDAR_RH") {
    throw new AppError(
      409,
      "PEDIDO_NAO_AGUARDA_RH",
      "Este pedido não está à espera de criação de conta pelos RH — só se pode confirmar a criação depois de aprovado."
    );
  }
  return pedido;
}

// Fluxo via RH (pedido da Sara, 2026-09-10): a coordenação deixa de criar a
// conta na hora ao aprovar — só decide o papel (e a turma, se for formando)
// e o pedido fica "a aguardar RH". É a criação da conta que fica pendente,
// fora da plataforma; ver marcarContaCriada() para o segundo passo. Ver
// PLANEAMENTO.md, "Pedidos de Acesso via RH", para as variantes discutidas
// e a escolhida.
async function aprovar(id, role, turmaId) {
  const pedido = await obterPendenteOuFalhar(id);

  const existente = await prisma.user.findUnique({ where: { email: pedido.email } });
  if (existente) {
    throw new AppError(409, "EMAIL_IN_USE", "Já existe uma conta criada com este email.");
  }

  if (turmaId) {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId } });
    if (!turma) {
      throw new AppError(404, "TURMA_NOT_FOUND", "Turma não encontrada.");
    }
    if (!turma.ativo) {
      throw new AppError(422, "TURMA_INATIVA", "Esta turma está inativa.");
    }
  }

  // Só transita se o pedido continuar PENDENTE (duas decisões em simultâneo: ganha uma).
  const { count } = await prisma.pedidoAcesso.updateMany({
    where: { id, estado: "PENDENTE" },
    data: { estado: "A_AGUARDAR_RH", roleDecidido: role, turmaIdDecidido: turmaId ?? null },
  });
  if (count !== 1) {
    throw new AppError(409, "PEDIDO_JA_TRATADO", "Este pedido já foi tratado por outra decisão.");
  }
  return prisma.pedidoAcesso.findUnique({ where: { id }, include: INCLUDE_TURMA_DECIDIDA });
}

// Segundo passo do fluxo via RH: confirma que os RH já trataram a criação
// da conta fora da plataforma — só agora é que a conta real é criada cá e
// as credenciais são enviadas por email à pessoa (mesmo mecanismo que já
// existia antes deste fluxo, só que adiado para este momento).
async function marcarContaCriada(id) {
  const pedido = await obterAAguardarRhOuFalhar(id);

  const existente = await prisma.user.findUnique({ where: { email: pedido.email } });
  if (existente) {
    throw new AppError(409, "EMAIL_IN_USE", "Já existe uma conta criada com este email.");
  }

  // A turma escolhida na aprovação pode ter sido desativada entretanto —
  // revalida antes de criar a conta em vez de deixar ficar uma referência
  // a uma turma inativa.
  if (pedido.turmaIdDecidido) {
    const turma = await prisma.turma.findUnique({ where: { id: pedido.turmaIdDecidido } });
    if (!turma || !turma.ativo) {
      throw new AppError(
        422,
        "TURMA_INATIVA",
        "A turma associada a este pedido já não está disponível — contacta a coordenação para decidir outra turma antes de confirmar a conta."
      );
    }
  }

  const passwordTemporaria = gerarPasswordTemporaria();
  const passwordHash = await bcrypt.hash(passwordTemporaria, SALT_ROUNDS);

  const [, trocaDeEstado] = await prisma.$transaction([
    prisma.user.create({
      data: {
        nome: pedido.nome,
        email: pedido.email,
        passwordHash,
        role: pedido.roleDecidido,
        ...(pedido.roleDecidido === "FORMADOR" ? { estadoFormador: "ATIVO" } : {}),
        turmaId: pedido.turmaIdDecidido,
      },
    }),
    prisma.pedidoAcesso.updateMany({ where: { id, estado: "A_AGUARDAR_RH" }, data: { estado: "APROVADO" } }),
  ]);
  if (trocaDeEstado.count !== 1) {
    // Perdeu a corrida: outro pedido de confirmação ou uma rejeição chegou primeiro.
    throw new AppError(409, "PEDIDO_JA_TRATADO", "Este pedido já foi tratado por outra decisão.");
  }
  const pedidoAtualizado = await prisma.pedidoAcesso.findUnique({ where: { id } });

  // Fase 8b (2026-09-02): a password nunca é devolvida ao coordenador — é
  // enviada diretamente por email à pessoa.
  let emailEnviado = true;
  try {
    await enviarCredenciaisAcesso({
      nome: pedido.nome,
      email: pedido.email,
      role: pedido.roleDecidido,
      passwordTemporaria,
    });
  } catch (erroEnvio) {
    // Não falhar a confirmação só porque o email não saiu — a conta já foi criada.
    // Fica registado no log do servidor para a coordenação poder agir manualmente.
    console.error("[pedidosAcesso] Falha ao enviar email de credenciais:", erroEnvio.message);
    emailEnviado = false;
  }

  return { pedido: pedidoAtualizado, emailEnviado };
}

// Rejeitar continua possível a partir de PENDENTE ou de A_AGUARDAR_RH (ex.:
// os RH acabam por não avançar, ou a coordenação muda de ideias antes de a
// conta ficar criada) — só deixa de ser possível depois de a conta já
// existir (APROVADO) ou se já tiver sido rejeitado.
async function rejeitar(id) {
  const pedido = await obterOuFalhar(id);
  if (pedido.estado === "APROVADO" || pedido.estado === "REJEITADO") {
    throw new AppError(409, "PEDIDO_JA_TRATADO", "Este pedido já foi aprovado ou rejeitado.");
  }
  const { count } = await prisma.pedidoAcesso.updateMany({
    where: { id, estado: { in: ["PENDENTE", "A_AGUARDAR_RH"] } },
    data: { estado: "REJEITADO" },
  });
  if (count !== 1) {
    throw new AppError(409, "PEDIDO_JA_TRATADO", "Este pedido já foi aprovado ou rejeitado.");
  }
  return prisma.pedidoAcesso.findUnique({ where: { id } });
}

module.exports = { criar, listar, aprovar, marcarContaCriada, rejeitar };
