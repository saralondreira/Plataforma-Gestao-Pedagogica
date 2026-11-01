const { z } = require("zod");
const formandosService = require("../services/formandos.service");

const atualizarTurmaSchema = z.object({
  // Obrigatório (mesmo que null) — força quem chama a decidir explicitamente
  // entre atribuir uma turma ou remover o formando de qualquer turma, em
  // vez de um PATCH parcial ambíguo.
  turmaId: z.coerce.number().int().positive().nullable(),
});

async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    res.json({ data: await formandosService.listar({ incluirInativos }) });
  } catch (error) {
    next(error);
  }
}

async function atualizarTurma(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { turmaId } = atualizarTurmaSchema.parse(req.body);
    const formando = await formandosService.atualizarTurma(id, turmaId);
    res.json({ data: formando });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, atualizarTurma };
