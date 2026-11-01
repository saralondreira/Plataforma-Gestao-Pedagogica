const { z } = require("zod");
const sumariosService = require("../services/sumarios.service");

const registarSchema = z.object({ texto: z.string().trim().min(10, "O sumário deve ter pelo menos 10 caracteres.").max(5000) });
const decidirSchema = z.object({ aceite: z.boolean(), nota: z.string().max(1000).optional() });

const envolver = (fn) => async (req, res, next) => {
  try {
    const { status = 200, data } = await fn(req);
    res.status(status).json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registar: envolver(async (req) => ({ data: await sumariosService.registar(req.user, Number(req.params.aulaId), registarSchema.parse(req.body).texto) })),
  daAula: envolver(async (req) => ({ data: await sumariosService.daAula(req.user, Number(req.params.aulaId)) })),
  decidir: envolver(async (req) => ({ data: await sumariosService.decidir(req.user, Number(req.params.id), decidirSchema.parse(req.body)) })),
  porValidar: envolver(async (req) => ({ data: await sumariosService.porValidar(req.user) })),
  porEscrever: envolver(async (req) => ({ data: await sumariosService.porEscrever(req.user) })),
  doFormador: envolver(async (req) => ({ data: await sumariosService.doFormador(req.user) })),
  daTurmaDoFormando: envolver(async (req) => ({ data: await sumariosService.daTurmaDoFormando(req.user) })),
};
