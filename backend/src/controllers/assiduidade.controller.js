const path = require("path");
const { z } = require("zod");
const assiduidadeService = require("../services/assiduidade.service");
const { AppError } = require("../utils/AppError");
const { UPLOADS_DIR } = require("../config/paths");

const registarSchema = z.object({
  presencas: z
    .array(
      z.object({
        formandoId: z.coerce.number().int().positive(),
        estado: z.enum(["PRESENTE", "AUSENTE"]),
      })
    )
    .min(1),
});

// Corpo multipart: os campos chegam como texto.
const justificacaoSchema = z.object({
  aulaId: z.coerce.number().int().positive(),
  motivo: z.string().trim().min(3).max(2000),
});

const decidirSchema = z.object({
  estado: z.enum(["ACEITE", "REJEITADA"]),
  notaDecisao: z.string().max(1000).optional(),
});

const filtroEstadoSchema = z.enum(["PENDENTE", "ACEITE", "REJEITADA"]).optional();

function envolver(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

const listarDaAula = envolver(async (req, res) => {
  res.json({ data: await assiduidadeService.listarDaAula(req.user, Number(req.params.aulaId)) });
});

const registar = envolver(async (req, res) => {
  const { presencas } = registarSchema.parse(req.body);
  res.json({ data: await assiduidadeService.registar(req.user, Number(req.params.aulaId), presencas) });
});

const minhas = envolver(async (req, res) => {
  res.json({ data: await assiduidadeService.minhas(req.user.id) });
});

// Não usa envolver(): se a validação falhar depois do upload, o ficheiro tem de ser apagado.
async function submeterJustificacao(req, res, next) {
  try {
    const dados = justificacaoSchema.parse(req.body);
    const justificacao = await assiduidadeService.submeterJustificacao(req.user.id, dados, req.file);
    res.status(201).json({ data: { ...justificacao, anexoUrl: undefined, temAnexo: Boolean(justificacao.anexoUrl) } });
  } catch (error) {
    if (req.file) require("fs").unlink(req.file.path, () => {});
    next(error);
  }
}

const listarJustificacoes = envolver(async (req, res) => {
  const estado = filtroEstadoSchema.parse(req.query.estado || undefined);
  res.json({ data: await assiduidadeService.listarJustificacoes(req.user, estado) });
});

const decidir = envolver(async (req, res) => {
  const dados = decidirSchema.parse(req.body);
  res.json({ data: await assiduidadeService.decidir(req.user, Number(req.params.id), dados) });
});

async function anexo(req, res, next) {
  try {
    const { formandoId, anexoUrl } = await assiduidadeService.obterAnexo(req.user, Number(req.params.id));
    const caminho = path.join(UPLOADS_DIR, "justificacoes", String(formandoId), path.basename(anexoUrl));
    res.sendFile(caminho, (erro) => {
      if (erro && !res.headersSent) {
        next(new AppError(404, "FICHEIRO_NOT_FOUND", "O ficheiro já não está disponível no servidor."));
      }
    });
  } catch (error) {
    next(error);
  }
}

const resumoDaTurma = envolver(async (req, res) => {
  res.json({ data: await assiduidadeService.resumoDaTurma(Number(req.params.turmaId)) });
});

module.exports = {
  listarDaAula,
  registar,
  minhas,
  submeterJustificacao,
  listarJustificacoes,
  decidir,
  anexo,
  resumoDaTurma,
};
