const { Router } = require("express");
const ucController = require("../controllers/uc.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /ucs:
 *   get:
 *     summary: Lista o catálogo de UCs (independente de turma)
 *     tags: [UCs]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Catálogo de UCs, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/UC' } } } } } } }
 */
router.get("/", ucController.listar);

// A partir daqui, só a coordenação gere o catálogo de UCs (criar/editar/apagar).
router.use(requireRole("COORDENADOR"));

/**
 * @openapi
 * /ucs:
 *   post:
 *     summary: Cria uma nova UC no catálogo (só coordenação)
 *     tags: [UCs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [abreviatura, nome, cargaHoraria]
 *             properties:
 *               abreviatura: { type: string, example: UC0004 }
 *               nome: { type: string }
 *               cargaHoraria: { type: integer, example: 50 }
 *     responses:
 *       201: { description: UC criada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/UC' } } } } } }
 *       409: { description: Abreviatura já existe no catálogo, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", ucController.criar);

/**
 * @openapi
 * /ucs/{id}:
 *   patch:
 *     summary: Atualiza uma UC do catálogo (só coordenação)
 *     tags: [UCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: UC atualizada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/UC' } } } } } }
 *       404: { description: UC não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   delete:
 *     summary: Desativa uma UC do catálogo (soft delete — mantém associações e aulas já existentes; deixa de aceitar novas associações)
 *     tags: [UCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: UC desativada }
 *       404: { description: UC não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id", ucController.atualizar);
router.delete("/:id", ucController.apagar);

/**
 * @openapi
 * /ucs/{id}/reativar:
 *   patch:
 *     summary: Reativa uma UC desativada (só coordenação)
 *     tags: [UCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: UC reativada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/UC' } } } } } }
 *       404: { description: UC não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/reativar", ucController.reativar);

module.exports = router;
