const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { formandoComTurma } = require("../lib/acesso");
const { notificar, idsDaCoordenacao } = require("../lib/notificacoes");

const INCLUDE_PARTES = {
  remetente: { select: { id: true, nome: true, role: true } },
  destinatario: { select: { id: true, nome: true } },
};

// Quem pode escrever a quem:
//  - FORMANDO  -> coordenação, assistente social, ou um formador da sua turma
//  - FORMADOR  -> coordenação
//  - COORDENADOR -> qualquer formador ativo
// ASSISTENTE_SOCIAL não é um papel da plataforma: essas mensagens são lidas e
// respondidas pela coordenação.

async function formadoresDaTurmaDoFormando(userId) {
  const formando = await formandoComTurma(userId);
  const associacoes = await prisma.turmaUc.findMany({
    where: { turmaId: formando.turmaId, ativo: true, formador: { ativo: true } },
    select: { formador: { select: { id: true, nome: true } } },
  });
  const unicos = new Map(associacoes.map((a) => [a.formador.id, a.formador]));
  return [...unicos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

async function destinatarios(user) {
  if (user.role === "FORMANDO") return formadoresDaTurmaDoFormando(user.id);
  if (user.role === "COORDENADOR") {
    return prisma.user.findMany({
      where: { role: "FORMADOR", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
  }
  return [];
}

async function enviar(user, { destino, destinatarioId, assunto, corpo }) {
  const naoPermitido = () => new AppError(403, "DESTINO_NAO_PERMITIDO", "Não podes enviar mensagens a este destinatário.");

  if (user.role === "FORMADOR" && destino !== "COORDENACAO") throw naoPermitido();
  if (user.role === "COORDENADOR" && destino !== "FORMADOR") throw naoPermitido();

  let destinoId = null;
  if (destino === "FORMADOR") {
    if (!destinatarioId) {
      throw new AppError(422, "VALIDATION_ERROR", "Indica o formador a quem queres escrever.");
    }
    const permitidos = await destinatarios(user);
    if (!permitidos.some((f) => f.id === destinatarioId)) throw naoPermitido();
    destinoId = destinatarioId;
  }

  const mensagem = await prisma.mensagem.create({
    data: { remetenteId: user.id, destino, destinatarioId: destinoId, assunto, corpo },
    include: INCLUDE_PARTES,
  });

  const paraQuem = destino === "FORMADOR" ? [destinoId] : await idsDaCoordenacao();
  await notificar(paraQuem, {
    tipo: "MENSAGEM_NOVA",
    assunto: `Nova mensagem de ${mensagem.remetente.nome}`,
    linhas: [`${mensagem.remetente.nome} enviou-te uma mensagem: "${assunto}".`, "Lê-a e responde na plataforma."],
  });

  return mensagem;
}

function filtroRecebidas(user) {
  if (user.role === "FORMADOR") return { destino: "FORMADOR", destinatarioId: user.id };
  if (user.role === "COORDENADOR") return { destino: { in: ["COORDENACAO", "ASSISTENTE_SOCIAL"] } };
  throw new AppError(403, "FORBIDDEN", "Não tens permissão para esta ação.");
}

async function recebidas(user) {
  return prisma.mensagem.findMany({
    where: filtroRecebidas(user),
    include: INCLUDE_PARTES,
    orderBy: { createdAt: "desc" },
  });
}

async function enviadas(user) {
  return prisma.mensagem.findMany({
    where: { remetenteId: user.id },
    include: INCLUDE_PARTES,
    orderBy: { createdAt: "desc" },
  });
}

// Só o destinatário (ou, para a coordenação, qualquer coordenador) mexe na mensagem recebida.
async function obterRecebidaOuFalhar(user, id) {
  const mensagem = await prisma.mensagem.findFirst({ where: { id, ...filtroRecebidas(user) } });
  if (!mensagem) {
    throw new AppError(404, "MENSAGEM_NOT_FOUND", "Mensagem não encontrada.");
  }
  return mensagem;
}

async function marcarLida(user, id) {
  await obterRecebidaOuFalhar(user, id);
  return prisma.mensagem.update({ where: { id }, data: { lida: true }, include: INCLUDE_PARTES });
}

async function responder(user, id, { resposta }) {
  const mensagem = await obterRecebidaOuFalhar(user, id);
  if (mensagem.resposta) {
    throw new AppError(409, "JA_RESPONDIDA", "Esta mensagem já foi respondida.");
  }
  // Só grava se ainda não houver resposta (duas respostas em simultâneo: ganha uma).
  const { count } = await prisma.mensagem.updateMany({
    where: { id, resposta: null },
    data: { resposta, respondidaEm: new Date(), lida: true },
  });
  if (count !== 1) {
    throw new AppError(409, "JA_RESPONDIDA", "Esta mensagem já foi respondida.");
  }
  const respondida = await prisma.mensagem.findUnique({ where: { id }, include: INCLUDE_PARTES });

  await notificar([mensagem.remetenteId], {
    tipo: "MENSAGEM_RESPONDIDA",
    assunto: `Resposta à tua mensagem: ${mensagem.assunto}`,
    linhas: [`A tua mensagem "${mensagem.assunto}" foi respondida.`, "Lê a resposta na plataforma."],
  });

  return respondida;
}

module.exports = { destinatarios, enviar, recebidas, enviadas, marcarLida, responder };
