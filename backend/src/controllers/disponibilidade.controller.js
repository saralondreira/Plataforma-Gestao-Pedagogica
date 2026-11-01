const { z } = require("zod");
const { dataISO } = require("../lib/validacao");
const disponibilidadeService = require("../services/disponibilidade.service");

const blocoSchema = z.object({
  data: dataISO.transform((v) => new Date(`${v}T00:00:00Z`)),
  horaInicio: z.coerce.number().int().min(0).max(23),
  estado: z.enum(["LIVRE", "BLOQUEADO"]).default("LIVRE"),
  motivo: z.string().optional(),
});

async function definirBloco(req, res, next) {
  try {
    const dados = blocoSchema.parse(req.body);
    const bloco = await disponibilidadeService.definirBloco(req.user.id, dados);
    res.status(201).json({ data: bloco });
  } catch (error) {
    next(error);
  }
}

async function listarMinha(req, res, next) {
  try {
    const { de, ate } = req.query;
    const blocos = await disponibilidadeService.listarPorFormador(req.user.id, {
      de: de ? new Date(de) : undefined,
      ate: ate ? new Date(ate) : undefined,
    });
    res.json({ data: blocos });
  } catch (error) {
    next(error);
  }
}

async function listarDeFormador(req, res, next) {
  try {
    const formadorId = Number(req.params.formadorId);
    const { de, ate } = req.query;
    const blocos = await disponibilidadeService.listarPorFormador(formadorId, {
      de: de ? new Date(de) : undefined,
      ate: ate ? new Date(ate) : undefined,
    });
    res.json({ data: blocos });
  } catch (error) {
    next(error);
  }
}

async function apagar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await disponibilidadeService.apagar(id, req.user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

const pedirSchema = z.object({
  formadorId: z.coerce.number().int().positive(),
  quando: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:00$/, "Formato AAAA-MM-DD HH:00").refine((v) => dataISO.safeParse(v.slice(0, 10)).success && Number(v.slice(11, 13)) <= 23, "Data ou hora inválida")).min(1).max(100),
});

async function pedirMarcacao(req, res, next) {
  try {
    const { formadorId, quando } = pedirSchema.parse(req.body);
    res.json({ data: await disponibilidadeService.pedirMarcacao(formadorId, quando) });
  } catch (error) {
    next(error);
  }
}

module.exports = { pedirMarcacao, definirBloco, listarMinha, listarDeFormador, apagar };
