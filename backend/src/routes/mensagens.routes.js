const { Router } = require("express");
const mensagensController = require("../controllers/mensagens.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /mensagens/destinatarios:
 *   get:
 *     summary: Formadores a quem o utilizador pode escrever (formando - os da sua turma; coordenação - todos)
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de formadores }
 */
router.get("/destinatarios", mensagensController.destinatarios);

/**
 * @openapi
 * /mensagens:
 *   post:
 *     summary: Envia uma mensagem (formando - coordenação, assistente social ou formador da turma; formador - coordenação; coordenação - formador)
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [destino, assunto, corpo]
 *             properties:
 *               destino: { type: string, enum: [COORDENACAO, FORMADOR, ASSISTENTE_SOCIAL] }
 *               destinatarioId: { type: integer, description: Obrigatório quando o destino é FORMADOR }
 *               assunto: { type: string }
 *               corpo: { type: string }
 *     responses:
 *       201: { description: Mensagem enviada }
 *       403: { description: Destinatário não permitido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", mensagensController.enviar);

/**
 * @openapi
 * /mensagens/enviadas:
 *   get:
 *     summary: As mensagens que enviei, com a resposta (se já houver)
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Mensagens enviadas }
 */
router.get("/enviadas", mensagensController.enviadas);

/**
 * @openapi
 * /mensagens/recebidas:
 *   get:
 *     summary: Mensagens recebidas (formador - as dirigidas a ele; coordenação - as dirigidas à coordenação e à assistente social)
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Mensagens recebidas }
 */
router.get("/recebidas", requireRole("FORMADOR", "COORDENADOR"), mensagensController.recebidas);

/**
 * @openapi
 * /mensagens/{id}/lida:
 *   patch:
 *     summary: Marca uma mensagem recebida como lida
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Mensagem marcada como lida }
 */
router.patch("/:id/lida", requireRole("FORMADOR", "COORDENADOR"), mensagensController.marcarLida);

/**
 * @openapi
 * /mensagens/{id}/responder:
 *   patch:
 *     summary: Responde a uma mensagem recebida (uma resposta por mensagem)
 *     tags: [Mensagens]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [resposta], properties: { resposta: { type: string } } }
 *     responses:
 *       200: { description: Resposta registada }
 *       409: { description: Já respondida, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/responder", requireRole("FORMADOR", "COORDENADOR"), mensagensController.responder);

module.exports = router;
