const { garantirAcessoLeituraTurma } = require("../lib/acesso");
const { z } = require("zod");
const turmaUcService = require("../services/turmaUc.service");

const associarSchema = z.object({
  turmaId: z.coerce.number().int().positive(),
  ucId: z.coerce.number().int().positive(),
  formadorId: z.coerce.number().int().positive(),
});

const atualizarSchema = z.object({
  formadorId: z.coerce.number().int().positive(),
});

const copiarSchema = z.object({
  origemTurmaId: z.coerce.number().int().positive(),
  destinoTurmaId: z.coerce.number().int().positive(),
});

async function copiar(req, res, next) {
  try {
    const { origemTurmaId, destinoTurmaId } = copiarSchema.parse(req.body);
    res.status(201).json({ data: await turmaUcService.copiar(origemTurmaId, destinoTurmaId) });
  } catch (error) {
    next(error);
  }
}

const substituirSchema = z.object({
  formadorId: z.coerce.number().int().positive(),
  cancelarSemBloco: z.boolean().optional().default(false),
});

async function substituirFormador(req, res, next) {
  try {
    const { formadorId, cancelarSemBloco } = substituirSchema.parse(req.body);
    res.json({ data: await turmaUcService.substituirFormador(Number(req.params.id), formadorId, { cancelarSemBloco }) });
  } catch (error) {
    next(error);
  }
}

async function listarPorTurma(req, res, next) {
  try {
    const turmaId = Number(req.params.turmaId);
    const incluirInativos = req.query.incluirInativos === "true";
    await garantirAcessoLeituraTurma(req.user, turmaId);
    const associacoes = await turmaUcService.listarPorTurma(turmaId, { incluirInativos: incluirInativos && req.user.role === "COORDENADOR" });
    res.json({ data: associacoes });
  } catch (error) {
    next(error);
  }
}

async function minhas(req, res, next) {
  try {
    res.json({ data: await turmaUcService.listarDoFormador(req.user.id) });
  } catch (error) {
    next(error);
  }
}

async function associar(req, res, next) {
  try {
    const dados = associarSchema.parse(req.body);
    const turmaUc = await turmaUcService.associar(dados);
    res.status(201).json({ data: turmaUc });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const dados = atualizarSchema.parse(req.body);
    const turmaUc = await turmaUcService.atualizar(id, dados);
    res.json({ data: turmaUc });
  } catch (error) {
    next(error);
  }
}

async function remover(req, res, next) {
  try {
    const id = Number(req.params.id);
    await turmaUcService.remover(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reativar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const turmaUc = await turmaUcService.reativar(id);
    res.json({ data: turmaUc });
  } catch (error) {
    next(error);
  }
}

module.exports = { substituirFormador, copiar, minhas, listarPorTurma, associar, atualizar, remover, reativar };
