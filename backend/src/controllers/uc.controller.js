const { z } = require("zod");
const ucService = require("../services/uc.service");

const criarSchema = z.object({
  abreviatura: z.string().min(2),
  nome: z.string().min(2),
  cargaHoraria: z.coerce.number().int().positive(),
});

const atualizarSchema = criarSchema.partial();

async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    const ucs = await ucService.listar({ incluirInativos });
    res.json({ data: ucs });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const dados = criarSchema.parse(req.body);
    const uc = await ucService.criar(dados);
    res.status(201).json({ data: uc });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const dados = atualizarSchema.parse(req.body);
    const uc = await ucService.atualizar(id, dados);
    res.json({ data: uc });
  } catch (error) {
    next(error);
  }
}

async function apagar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await ucService.apagar(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reativar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const uc = await ucService.reativar(id);
    res.json({ data: uc });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, criar, atualizar, apagar, reativar };
