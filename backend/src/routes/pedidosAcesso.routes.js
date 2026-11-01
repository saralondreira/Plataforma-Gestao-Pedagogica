const { Router } = require("express");
const pedidosAcessoController = require("../controllers/pedidosAcesso.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { limitadorPedidosAcesso } = require("../middleware/rateLimit");

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
router.post("/", limitadorPedidosAcesso, pedidosAcessoController.criar);

// A partir daqui, só a coordenação pode tratar pedidos (aprovar cria uma conta real).
router.use(requireAuth, requireRole("COORDENADOR"));

/**
 * @openapi
 * /pedidos-acesso:
 *   get:
 *     summary: Lista todos os pedidos de acesso (só coordenação)
 *     tags: [Pedidos de Acesso]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de pedidos, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/PedidoAcesso' } } } } } } }
 *       403: { description: Só a coordenação pode listar pedidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/", pedidosAcessoController.listar);

/**
 * @openapi
 * /pedidos-acesso/{id}/aprovar:
 *   patch:
 *     summary: Aprova um pedido, escolhendo o papel (e turma) — fica a aguardar a criação da conta pelos RH (só coordenação)
 *     description: >
 *       Não cria a conta na hora — a partir da Fase RH (2026-09-10) a criação da conta é
 *       tratada pelos Recursos Humanos fora da plataforma. Este passo só regista a decisão
 *       (papel e, se for formando, turma) e muda o estado do pedido para A_AGUARDAR_RH.
 *       Ver PATCH /pedidos-acesso/{id}/confirmar-conta-criada para o passo seguinte.
 *     tags: [Pedidos de Acesso]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [COORDENADOR, FORMADOR, FORMANDO] }
 *               turmaId: { type: integer, description: "Só relevante quando role=FORMANDO — a turma em que a pessoa fica inscrita." }
 *     responses:
 *       200: { description: Pedido aprovado — fica com estado A_AGUARDAR_RH, ainda sem conta criada }
 *       404: { description: Pedido não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Pedido já tratado, ou já existe conta com este email, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/aprovar", pedidosAcessoController.aprovar);

/**
 * @openapi
 * /pedidos-acesso/{id}/confirmar-conta-criada:
 *   patch:
 *     summary: Confirma que os RH já criaram a conta — cria a conta real cá e envia as credenciais (só coordenação)
 *     description: >
 *       Segundo passo do fluxo via RH: só é aceite se o pedido estiver com estado A_AGUARDAR_RH
 *       (ou seja, já foi aprovado). Cria a conta com o papel/turma decididos em /aprovar e envia
 *       as credenciais por email à pessoa, tal como acontecia antes na aprovação.
 *     tags: [Pedidos de Acesso]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Conta criada e credenciais enviadas por email à pessoa }
 *       404: { description: Pedido não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Pedido não está a aguardar RH, ou já existe conta com este email, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/confirmar-conta-criada", pedidosAcessoController.marcarContaCriada);

/**
 * @openapi
 * /pedidos-acesso/{id}/rejeitar:
 *   patch:
 *     summary: Rejeita um pedido de acesso (só coordenação)
 *     description: Aceite tanto a partir de PENDENTE como de A_AGUARDAR_RH — só deixa de ser possível depois de a conta já estar criada (APROVADO).
 *     tags: [Pedidos de Acesso]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Pedido rejeitado }
 *       404: { description: Pedido não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Pedido já tratado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/rejeitar", pedidosAcessoController.rejeitar);

module.exports = router;
