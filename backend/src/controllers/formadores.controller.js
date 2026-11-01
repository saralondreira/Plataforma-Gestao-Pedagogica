const { z } = require("zod");
const { passwordNova } = require("../lib/validacao");
const formadoresService = require("../services/formadores.service");

const criarSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: passwordNova,
  sigla: z.string().max(4).optional(),
  turmasQtd: z.coerce.number().int().min(0).default(0),
  ucsQtd: z.coerce.number().int().min(0).default(0),
  estadoFormador: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
});

const atualizarSchema = z.object({
  nome: z.string().min(2).optional(),
  sigla: z.string().max(4).optional(),
  turmasQtd: z.coerce.number().int().min(0).optional(),
  ucsQtd: z.coerce.number().int().min(0).optional(),
  estadoFormador: z.enum(["ATIVO", "INATIVO"]).optional(),
});

async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    res.json({ data: await formadoresService.listar({ incluirInativos }) });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const dados = criarSchema.parse(req.body);
    const formador = await formadoresService.criar(dados);
    res.status(201).json({ data: formador });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const dados = atualizarSchema.parse(req.body);
    const formador = await formadoresService.atualizar(id, dados);
    res.json({ data: formador });
  } catch (error) {
    next(error);
  }
}

async function apagar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await formadoresService.apagar(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reativar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const formador = await formadoresService.reativar(id);
    res.json({ data: formador });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, criar, atualizar, apagar, reativar };
