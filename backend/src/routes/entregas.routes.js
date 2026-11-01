const { Router } = require("express");
const entregasController = require("../controllers/entregas.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /entregas:
 *   get:
 *     summary: Lista todas as entregas (vista da coordenadora)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de entregas, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Entrega' } } } } } } }
 *   post:
 *     summary: Cria um novo aviso de documento (coordenadora)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [formadorId, turmaId, documento, dataLimite]
 *             properties:
 *               formadorId: { type: integer }
 *               turmaId: { type: integer }
 *               documento: { type: string }
 *               dataLimite: { type: string, format: date }
 *     responses:
 *       201: { description: Entrega criada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Entrega' } } } } } }
 */
router.get("/", requireRole("COORDENADOR"), entregasController.listar);

/**
 * @openapi
 * /entregas/minhas:
 *   get:
 *     summary: Lista as entregas atribuídas ao formador autenticado
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de entregas do formador, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Entrega' } } } } } } }
 */
router.get("/minhas", entregasController.listarMinhas);
router.post("/", requireRole("COORDENADOR"), entregasController.criar);

/**
 * @openapi
 * /entregas/{id}:
 *   patch:
 *     summary: Atualiza os dados de um aviso (coordenadora)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Entrega atualizada }
 *   delete:
 *     summary: Desativa um aviso (soft delete — mantém o histórico de submissões)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Entrega desativada }
 */
router.patch("/:id", requireRole("COORDENADOR"), entregasController.atualizar);
router.delete("/:id", requireRole("COORDENADOR"), entregasController.apagar);

/**
 * @openapi
 * /entregas/{id}/reativar:
 *   patch:
 *     summary: Reativa uma entrega desativada
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Entrega reativada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Entrega' } } } } } }
 */
router.patch("/:id/reativar", requireRole("COORDENADOR"), entregasController.reativar);

/**
 * @openapi
 * /entregas/{id}/marcar-entregue:
 *   patch:
 *     summary: A coordenadora marca manualmente uma entrega como concluída
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Entrega marcada como entregue (submissaoTipo=COORDENACAO) }
 */
router.patch("/:id/marcar-entregue", requireRole("COORDENADOR"), entregasController.marcarComoEntregue);

/**
 * @openapi
 * /entregas/{id}/submeter:
 *   post:
 *     summary: O formador submete o documento (upload de ficheiro)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties: { ficheiro: { type: string, format: binary } }
 *     responses:
 *       200: { description: Documento submetido (submissaoTipo=FICHEIRO) }
 *       403: { description: Não és o formador desta entrega, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/:id/submeter", upload.single("ficheiro"), entregasController.submeter);

/**
 * @openapi
 * /entregas/{id}/excecao:
 *   post:
 *     summary: O formador marca como enviado sem ficheiro (exceção, com nota)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nota], properties: { nota: { type: string } } }
 *     responses:
 *       200: { description: Entrega marcada (submissaoTipo=EXCECAO) }
 *       403: { description: Não és o formador desta entrega, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/:id/excecao", entregasController.excecao);

/**
 * @openapi
 * /entregas/{id}/ficheiro:
 *   get:
 *     summary: Descarrega o ficheiro submetido (só o formador dono ou a coordenação)
 *     tags: [Entregas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: O ficheiro }
 *       403: { description: Não és o formador desta entrega, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       404: { description: Sem ficheiro submetido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/:id/ficheiro", entregasController.ficheiro);

module.exports = router;
