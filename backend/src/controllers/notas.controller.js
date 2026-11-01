const { z } = require("zod");
const notasService = require("../services/notas.service");

const lancarSchema = z.object({
  valor: z.preprocess((v) => (v === null || v === "" || typeof v === "boolean" ? undefined : v), z.coerce.number().min(0).max(20)),
  observacoes: z.string().max(1000).optional(),
});

async function listarDaTurmaUc(req, res, next) {
  try {
    res.json({ data: await notasService.listarDaTurmaUc(req.user, Number(req.params.turmaUcId)) });
  } catch (error) {
    next(error);
  }
}

async function lancar(req, res, next) {
  try {
    const dados = lancarSchema.parse(req.body);
    const nota = await notasService.lancar(req.user, Number(req.params.turmaUcId), Number(req.params.formandoId), dados);
    res.json({ data: nota });
  } catch (error) {
    next(error);
  }
}

async function historico(req, res, next) {
  try {
    res.json({ data: await notasService.historico(req.user, Number(req.params.turmaUcId), Number(req.params.formandoId)) });
  } catch (error) {
    next(error);
  }
}

async function listarMinhas(req, res, next) {
  try {
    res.json({ data: await notasService.listarMinhas(req.user.id) });
  } catch (error) {
    next(error);
  }
}

async function pautaDaTurma(req, res, next) {
  try {
    res.json({ data: await notasService.pautaDaTurma(Number(req.params.turmaId)) });
  } catch (error) {
    next(error);
  }
}

module.exports = { historico, listarDaTurmaUc, lancar, listarMinhas, pautaDaTurma, lancarSchema };
