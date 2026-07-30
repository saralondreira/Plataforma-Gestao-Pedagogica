const { Router } = require("express");
const turmasController = require("../controllers/turmas.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /turmas:
 *   get:
 *     summary: Lista todas as turmas
 *     tags: [Turmas]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de turmas
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Turma' } } } }
 *   post:
 *     summary: Cria uma nova turma
 *     tags: [Turmas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo, designacao, dataInicio]
 *             properties:
 *               codigo: { type: string }
 *               designacao: { type: string }
 *               dataInicio: { type: string, format: date }
 *               numFormandos: { type: integer, default: 20 }
 *               estado: { type: string, enum: [PLANEADA, EM_CURSO, CONCLUIDA] }
 *     responses:
 *       201: { description: Turma criada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Turma' } } } } } }
 *       409: { description: Código já em uso, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/", turmasController.listar);
router.post("/", turmasController.criar);

/**
 * @openapi
 * /turmas/{id}:
 *   patch:
 *     summary: Atualiza uma turma
 *     tags: [Turmas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Campos parciais de Turma" }
 *     responses:
 *       200: { description: Turma atualizada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Turma' } } } } } }
 *       404: { description: Turma não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   delete:
 *     summary: Apaga uma turma
 *     tags: [Turmas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Turma apagada }
 *       404: { description: Turma não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id", turmasController.atualizar);
router.delete("/:id", turmasController.apagar);

module.exports = router;
