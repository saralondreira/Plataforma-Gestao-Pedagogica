const { z } = require("zod");
const pedidosAcessoService = require("../services/pedidosAcesso.service");

const criarSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cargo: z.string().min(2),
  motivo: z.string().optional().default(""),
});

async function criar(req, res, next) {
  try {
    const dados = criarSchema.parse(req.body);
    const pedido = await pedidosAcessoService.criar(dados);
    res.status(201).json({ data: pedido });
  } catch (error) {
    next(error);
  }
}

module.exports = { criar };
