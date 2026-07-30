const { z } = require("zod");
const turmasService = require("../services/turmas.service");

const turmaSchema = z.object({
  codigo: z.string().min(2),
  designacao: z.string().min(2),
  dataInicio: z.coerce.date(),
  numFormandos: z.coerce.number().int().positive().default(20),
  estado: z.enum(["PLANEADA", "EM_CURSO", "CONCLUIDA"]).default("PLANEADA"),
});

const turmaUpdateSchema = turmaSchema.partial();

async function listar(req, res, next) {
  try {
    const turmas = await turmasService.listar();
    res.json({ data: turmas });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const dados = turmaSchema.parse(req.body);
    const turma = await turmasService.criar(dados);
    res.status(201).json({ data: turma });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const dados = turmaUpdateSchema.parse(req.body);
    const turma = await turmasService.atualizar(id, dados);
    res.json({ data: turma });
  } catch (error) {
    next(error);
  }
}

async function apagar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await turmasService.apagar(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, criar, atualizar, apagar, turmaSchema, turmaUpdateSchema };
