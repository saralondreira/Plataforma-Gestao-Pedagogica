const { z } = require("zod");
const { passwordNova } = require("../lib/validacao");
const formandosService = require("../services/formandos.service");

const atualizarTurmaSchema = z.object({
  // Obrigatório (mesmo que null) — força quem chama a decidir explicitamente
  // entre atribuir uma turma ou remover o formando de qualquer turma, em
  // vez de um PATCH parcial ambíguo.
  turmaId: z.coerce.number().int().positive().nullable(),
});

const turmaOpcional = z.coerce.number().int().positive().nullable();

const criarSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: passwordNova,
  turmaId: turmaOpcional.optional(),
});

const atualizarSchema = z
  .object({
    nome: z.string().trim().min(2).optional(),
    email: z.string().trim().email().optional(),
    turmaId: turmaOpcional.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "Indica pelo menos um campo a alterar.");

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

async function criar(req, res, next) {
  try {
    const formando = await formandosService.criar(criarSchema.parse(req.body));
    res.status(201).json({ data: formando });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const formando = await formandosService.atualizar(Number(req.params.id), atualizarSchema.parse(req.body));
    res.json({ data: formando });
  } catch (error) {
    next(error);
  }
}

async function desativar(req, res, next) {
  try {
    await formandosService.desativar(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reativar(req, res, next) {
  try {
    res.json({ data: await formandosService.reativar(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
}

async function reporPassword(req, res, next) {
  try {
    const { password } = z.object({ password: passwordNova }).parse(req.body);
    await formandosService.reporPassword(Number(req.params.id), password);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, criar, atualizar, atualizarTurma, desativar, reativar, reporPassword };
