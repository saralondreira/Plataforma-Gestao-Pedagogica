const path = require("path");
const fs = require("fs");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { UPLOADS_DIR } = require("../config/paths");
const { notificar } = require("../lib/notificacoes");
const { obterTurmaUcOuFalhar, garantirResponsavelOuCoordenador, formandosDaTurma, formandoComTurma } = require("../lib/acesso");

const INCLUDE = {
  enviadoPor: { select: { id: true, nome: true } },
  turmaUc: { select: { id: true, turmaId: true, uc: { select: { abreviatura: true, nome: true } }, turma: { select: { id: true, codigo: true } } } },
};

const limpar = (texto) => String(texto).replace(/[^a-zA-Z0-9\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// Nome oficial pedido no estudo de caso: IDCurso_UC_Data.ext. Se o curso não
// tiver ID do IEFP usa-se o código da turma. Uploads no mesmo dia ganham _v2, _v3…
async function gerarNomePadrao(turmaUc, extensao) {
  const idCurso = limpar(turmaUc.turma.idCursoIEFP || turmaUc.turma.codigo);
  const base = `${idCurso}_${limpar(turmaUc.uc.abreviatura)}_${new Date().toISOString().slice(0, 10)}`;
  const iguais = await prisma.documentoUc.count({ where: { turmaUcId: turmaUc.id, nomePadrao: { startsWith: base } } });
  return `${base}${iguais ? `_v${iguais + 1}` : ""}${extensao}`;
}

// Leitura: responsável, coordenação, mediador da turma e formandos da turma.
async function garantirAcessoLeitura(user, turmaUc) {
  if (user.role === "COORDENADOR") return;
  if (user.role === "FORMADOR" && (turmaUc.formadorId === user.id || turmaUc.turma.mediadorId === user.id)) return;
  if (user.role === "FORMANDO") {
    const formando = await formandoComTurma(user.id);
    if (formando.turmaId === turmaUc.turmaId) return;
  }
  throw new AppError(403, "FORBIDDEN", "Não tens acesso aos documentos desta UC.");
}

async function enviar(user, turmaUcId, ficheiro, categoria) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);
  if (!ficheiro) {
    throw new AppError(422, "VALIDATION_ERROR", "Nenhum ficheiro enviado.");
  }
  const nomePadrao = await gerarNomePadrao(turmaUc, path.extname(ficheiro.originalname).toLowerCase());
  const documento = await prisma.documentoUc.create({
    data: {
      turmaUcId,
      categoria,
      nomePadrao,
      nomeOriginal: ficheiro.originalname,
      ficheiro: ficheiro.filename,
      tamanho: ficheiro.size,
      enviadoPorId: user.id,
    },
    include: INCLUDE,
  });

  const formandos = await formandosDaTurma(turmaUc.turmaId);
  await notificar(
    formandos.map((f) => f.id),
    {
      tipo: "DOCUMENTO_NOVO",
      assunto: `Novo documento em ${turmaUc.uc.abreviatura}`,
      linhas: [`Foi adicionado um documento à UC ${turmaUc.uc.abreviatura} (${turmaUc.turma.codigo}). Consulta-o na plataforma.`],
    }
  );
  return documento;
}

// Lista de uma UC. O histórico (com os removidos) é só para quem gere a UC.
async function listarDaTurmaUc(user, turmaUcId, { historico = false } = {}) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  await garantirAcessoLeitura(user, turmaUc);
  const veHistorico = historico && (user.role === "COORDENADOR" || (user.role === "FORMADOR" && turmaUc.formadorId === user.id));
  return prisma.documentoUc.findMany({
    where: { turmaUcId, ...(veHistorico ? {} : { ativo: true }) },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// Formando: todos os documentos ativos das UCs da sua turma.
async function daTurmaDoFormando(user) {
  const formando = await formandoComTurma(user.id);
  return prisma.documentoUc.findMany({
    where: { ativo: true, turmaUc: { turmaId: formando.turmaId, ativo: true } },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

async function obterOuFalhar(id) {
  const documento = await prisma.documentoUc.findUnique({ where: { id }, include: INCLUDE });
  if (!documento) {
    throw new AppError(404, "DOCUMENTO_NOT_FOUND", "Documento não encontrado.");
  }
  return documento;
}

// Remover = esconder (soft delete); o ficheiro e o registo ficam no histórico.
async function remover(user, id) {
  const documento = await obterOuFalhar(id);
  garantirResponsavelOuCoordenador(user, await obterTurmaUcOuFalhar(documento.turmaUcId));
  if (!documento.ativo) {
    throw new AppError(409, "DOCUMENTO_JA_REMOVIDO", "Este documento já foi removido.");
  }
  return prisma.documentoUc.update({ where: { id }, data: { ativo: false, removidoEm: new Date() }, include: INCLUDE });
}

// Devolve o caminho em disco + o nome oficial para o descarregamento.
async function obterFicheiro(user, id) {
  const documento = await obterOuFalhar(id);
  const turmaUc = await obterTurmaUcOuFalhar(documento.turmaUcId);
  await garantirAcessoLeitura(user, turmaUc);
  const veRemovidos = user.role === "COORDENADOR" || (user.role === "FORMADOR" && turmaUc.formadorId === user.id);
  if (!documento.ativo && !veRemovidos) {
    throw new AppError(404, "DOCUMENTO_NOT_FOUND", "Documento não encontrado.");
  }
  const caminho = path.join(UPLOADS_DIR, "documentos", String(documento.turmaUcId), path.basename(documento.ficheiro));
  return { caminho, nome: documento.nomePadrao };
}

function apagarFicheiroEnviado(ficheiro) {
  if (ficheiro) fs.unlink(ficheiro.path, () => {});
}

module.exports = { enviar, listarDaTurmaUc, daTurmaDoFormando, remover, obterFicheiro, apagarFicheiroEnviado };
