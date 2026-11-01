const { z } = require("zod");
const pedidosAcessoService = require("../services/pedidosAcesso.service");

const criarSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  cargo: z.string().min(2),
  motivo: z.string().optional().default(""),
});

const aprovarSchema = z.object({
  role: z.enum(["COORDENADOR", "FORMADOR", "FORMANDO"]),
  // Só faz sentido quando role = FORMANDO, mas não vale a pena impedir nos
  // outros casos — o serviço só usa isto para associar a turma no User.
  turmaId: z.coerce.number().int().positive().optional(),
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

async function listar(req, res, next) {
  try {
    const pedidos = await pedidosAcessoService.listar();
    res.json({ data: pedidos });
  } catch (error) {
    next(error);
  }
}

async function aprovar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { role, turmaId } = aprovarSchema.parse(req.body);
    const resultado = await pedidosAcessoService.aprovar(id, role, turmaId);
    res.json({ data: resultado });
  } catch (error) {
    next(error);
  }
}

async function marcarContaCriada(req, res, next) {
  try {
    const id = Number(req.params.id);
    const resultado = await pedidosAcessoService.marcarContaCriada(id);
    res.json({ data: resultado });
  } catch (error) {
    next(error);
  }
}

async function rejeitar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pedido = await pedidosAcessoService.rejeitar(id);
    res.json({ data: pedido });
  } catch (error) {
    next(error);
  }
}

module.exports = { criar, listar, aprovar, marcarContaCriada, rejeitar };
