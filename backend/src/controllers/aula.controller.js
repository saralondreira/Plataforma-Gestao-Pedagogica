const { obterTurmaUcOuFalhar, garantirAcessoLeituraTurmaUc } = require("../lib/acesso");
const { z } = require("zod");
const { dataISO } = require("../lib/validacao");
const aulaService = require("../services/aula.service");

const criarSchema = z.object({
  turmaUcId: z.coerce.number().int().positive(),
  disponibilidadeId: z.coerce.number().int().positive(),
  modalidade: z.enum(["PRESENCIAL", "ONLINE"]),
});

async function listarPorTurmaUc(req, res, next) {
  try {
    const turmaUcId = Number(req.params.turmaUcId);
    await garantirAcessoLeituraTurmaUc(req.user, await obterTurmaUcOuFalhar(turmaUcId));
    const aulas = await aulaService.listarPorTurmaUc(turmaUcId);
    res.json({ data: aulas });
  } catch (error) {
    next(error);
  }
}

async function listarPorTurma(req, res, next) {
  try {
    const { de, ate } = req.query;
    res.json({ data: await aulaService.listarPorTurma(Number(req.params.turmaId), de, ate) });
  } catch (error) {
    next(error);
  }
}

async function listarMinhas(req, res, next) {
  try {
    const { de, ate } = req.query;
    res.json({ data: await aulaService.listarMinhas(req.user, de, ate) });
  } catch (error) {
    next(error);
  }
}

const loteSchema = z.object({
  turmaUcId: z.coerce.number().int().positive(),
  disponibilidadeIds: z.array(z.coerce.number().int().positive()).min(1).max(60),
  modalidade: z.enum(["PRESENCIAL", "ONLINE"]),
});

async function criarLote(req, res, next) {
  try {
    const dados = loteSchema.parse(req.body);
    res.status(201).json({ data: await aulaService.criarLote(dados) });
  } catch (error) {
    next(error);
  }
}

async function listarGeral(req, res, next) {
  try {
    const { de, ate, turmaId, formadorId } = req.query;
    res.json({
      data: await aulaService.listarGeral({
        de,
        ate,
        turmaId: turmaId ? Number(turmaId) : undefined,
        formadorId: formadorId ? Number(formadorId) : undefined,
      }),
    });
  } catch (error) {
    next(error);
  }
}

const repetirSchema = z.object({
  turmaId: z.coerce.number().int().positive(),
  semanaDe: dataISO,
  numSemanas: z.coerce.number().int().min(1).max(16),
});

async function repetirSemana(req, res, next) {
  try {
    res.status(201).json({ data: await aulaService.repetirSemana(repetirSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const dados = criarSchema.parse(req.body);
    const aula = await aulaService.criar(dados);
    res.status(201).json({ data: aula });
  } catch (error) {
    next(error);
  }
}

const reagendarSchema = z.object({
  disponibilidadeId: z.coerce.number().int().positive(),
  modalidade: z.enum(["PRESENCIAL", "ONLINE"]).optional(),
});

async function reagendar(req, res, next) {
  try {
    const dados = reagendarSchema.parse(req.body);
    res.json({ data: await aulaService.reagendar(Number(req.params.id), dados) });
  } catch (error) {
    next(error);
  }
}

async function relatorioHoras(req, res, next) {
  try {
    const { de, ate } = req.query;
    res.json({ data: await aulaService.relatorioHorasPorFormador(de, ate) });
  } catch (error) {
    next(error);
  }
}

async function cancelar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await aulaService.cancelar(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { repetirSemana, listarGeral, criarLote, relatorioHoras, reagendar, listarMinhas, listarPorTurma, listarPorTurmaUc, criar, cancelar };
