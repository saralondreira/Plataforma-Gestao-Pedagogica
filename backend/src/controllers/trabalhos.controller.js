const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const trabalhosService = require("../services/trabalhos.service");
const { AppError } = require("../utils/AppError");
const { UPLOADS_DIR } = require("../config/paths");

const criarSchema = z.object({
  turmaUcId: z.coerce.number().int().positive(),
  titulo: z.string().trim().min(3).max(150),
  descricao: z.string().max(5000).default(""),
  dataLimite: z.coerce.date(),
});

const atualizarSchema = criarSchema.omit({ turmaUcId: true }).partial();

const submissaoSchema = z.object({
  comentario: z.string().max(1000).optional(),
});

const avaliarSchema = z.object({
  avaliacao: z.preprocess((v) => (v === null || v === "" || typeof v === "boolean" ? NaN : v), z.coerce.number().min(0).max(20)).optional(),
  feedback: z.string().max(2000).optional(),
});

function rota(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

const criar = rota(async (req, res) => {
  const dados = criarSchema.parse(req.body);
  res.status(201).json({ data: await trabalhosService.criar(req.user, dados) });
});

const listarDaTurmaUc = rota(async (req, res) => {
  res.json({ data: await trabalhosService.listarDaTurmaUc(req.user, Number(req.params.turmaUcId)) });
});

const atualizar = rota(async (req, res) => {
  const dados = atualizarSchema.parse(req.body);
  res.json({ data: await trabalhosService.atualizar(req.user, Number(req.params.id), dados) });
});

const apagar = rota(async (req, res) => {
  await trabalhosService.apagar(req.user, Number(req.params.id));
  res.status(204).send();
});

const listarSubmissoes = rota(async (req, res) => {
  res.json({ data: await trabalhosService.listarSubmissoes(req.user, Number(req.params.id)) });
});

const avaliar = rota(async (req, res) => {
  const dados = avaliarSchema.parse(req.body);
  res.json({ data: await trabalhosService.avaliar(req.user, Number(req.params.id), dados) });
});

const minhas = rota(async (req, res) => {
  res.json({ data: await trabalhosService.minhas(req.user.id) });
});

// Não usa rota(): se a validação falhar depois do upload, o ficheiro tem de ser apagado.
async function submeter(req, res, next) {
  try {
    const dados = submissaoSchema.parse(req.body);
    const submissao = await trabalhosService.submeter(req.user.id, Number(req.params.id), dados, req.file);
    res.status(201).json({ data: { ...submissao, ficheiroUrl: undefined } });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(error);
  }
}

async function ficheiro(req, res, next) {
  try {
    const { trabalhoId, ficheiroUrl } = await trabalhosService.obterFicheiroSubmissao(req.user, Number(req.params.id));
    const caminho = path.join(UPLOADS_DIR, "trabalhos", String(trabalhoId), path.basename(ficheiroUrl));
    res.sendFile(caminho, (erro) => {
      if (erro && !res.headersSent) {
        next(new AppError(404, "FICHEIRO_NOT_FOUND", "O ficheiro já não está disponível no servidor."));
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { criar, listarDaTurmaUc, atualizar, apagar, listarSubmissoes, avaliar, minhas, submeter, ficheiro };
