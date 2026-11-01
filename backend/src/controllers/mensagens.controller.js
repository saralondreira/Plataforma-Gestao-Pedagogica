const { z } = require("zod");
const mensagensService = require("../services/mensagens.service");

const enviarSchema = z.object({
  destino: z.enum(["COORDENACAO", "FORMADOR", "ASSISTENTE_SOCIAL"]),
  destinatarioId: z.coerce.number().int().positive().optional(),
  assunto: z.string().trim().min(3).max(150),
  corpo: z.string().trim().min(3).max(5000),
});

const responderSchema = z.object({
  resposta: z.string().trim().min(1).max(5000),
});

function rota(fn, status = 200) {
  return async (req, res, next) => {
    try {
      const data = await fn(req);
      if (data === undefined) return res.status(204).send();
      res.status(status).json({ data });
    } catch (error) {
      next(error);
    }
  };
}

const destinatarios = rota((req) => mensagensService.destinatarios(req.user));
const enviar = rota((req) => mensagensService.enviar(req.user, enviarSchema.parse(req.body)), 201);
const recebidas = rota((req) => mensagensService.recebidas(req.user));
const enviadas = rota((req) => mensagensService.enviadas(req.user));
const marcarLida = rota((req) => mensagensService.marcarLida(req.user, Number(req.params.id)));
const responder = rota((req) => mensagensService.responder(req.user, Number(req.params.id), responderSchema.parse(req.body)));

module.exports = { destinatarios, enviar, recebidas, enviadas, marcarLida, responder };
