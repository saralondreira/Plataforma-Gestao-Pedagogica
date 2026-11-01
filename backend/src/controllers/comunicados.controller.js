const { z } = require("zod");
const comunicadosService = require("../services/comunicados.service");

const enviarSchema = z.object({
  turmaId: z.coerce.number().int().positive(),
  assunto: z.string().trim().min(3, "O assunto deve ter pelo menos 3 caracteres.").max(150),
  corpo: z.string().trim().min(5, "Escreve a mensagem.").max(5000),
});

const envolver = (fn) => async (req, res, next) => {
  try {
    const { status = 200, data } = await fn(req);
    if (status === 204) return res.status(204).end();
    res.status(status).json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enviar: envolver(async (req) => ({ status: 201, data: await comunicadosService.enviar(req.user, enviarSchema.parse(req.body)) })),
  enviados: envolver(async (req) => ({ data: await comunicadosService.enviados(req.user) })),
  turmasEnvio: envolver(async (req) => ({ data: await comunicadosService.turmasEnvio(req.user) })),
  daTurma: envolver(async (req) => ({ data: await comunicadosService.daTurmaDoFormando(req.user) })),
  remover: envolver(async (req) => {
    await comunicadosService.remover(req.user, Number(req.params.id));
    return { status: 204 };
  }),
};
