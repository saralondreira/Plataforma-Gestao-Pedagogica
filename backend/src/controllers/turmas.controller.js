const { z } = require("zod");
const turmasService = require("../services/turmas.service");

const turmaSchema = z.object({
  codigo: z.string().min(2),
  designacao: z.string().min(2),
  dataInicio: z.coerce.date(),
  numFormandos: z.coerce.number().int().positive().default(20),
  estado: z.enum(["PLANEADA", "EM_CURSO", "CONCLUIDA"]).default("PLANEADA"),
  idCursoIEFP: z.string().optional(),
  // .nullable() antes de .optional() para aceitar explicitamente `null` (remover
  // o mediador já atribuído) sem ser coagido para 0 pelo z.coerce.number() —
  // omitido continua a significar "não mexer no campo" (graças ao .partial() no update).
  mediadorId: z.coerce.number().int().positive().nullable().optional(),
});

const turmaUpdateSchema = turmaSchema.partial();

async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    const turmas = await turmasService.listar({ incluirInativos });
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

async function reativar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const turma = await turmasService.reativar(id);
    res.json({ data: turma });
  } catch (error) {
    next(error);
  }
}

async function minhasMediacoes(req, res, next) {
  try {
    res.json({ data: await require("../services/mediacao.service").minhasTurmas(req.user.id) });
  } catch (error) {
    next(error);
  }
}

module.exports = { minhasMediacoes, listar, criar, atualizar, apagar, reativar, turmaSchema, turmaUpdateSchema };
