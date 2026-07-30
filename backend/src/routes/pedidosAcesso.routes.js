const { Router } = require("express");
const pedidosAcessoController = require("../controllers/pedidosAcesso.controller");

const router = Router();

/**
 * @openapi
 * /pedidos-acesso:
 *   post:
 *     summary: Submete um pedido de acesso (rota pública, sem autenticação)
 *     tags: [Pedidos de Acesso]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, cargo]
 *             properties:
 *               nome: { type: string }
 *               email: { type: string, format: email }
 *               cargo: { type: string }
 *               motivo: { type: string }
 *     responses:
 *       201: { description: Pedido registado (estado=PENDENTE), content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/PedidoAcesso' } } } } } }
 *       422: { description: Dados inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", pedidosAcessoController.criar);

module.exports = router;
