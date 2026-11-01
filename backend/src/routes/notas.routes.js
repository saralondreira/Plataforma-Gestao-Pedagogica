const { Router } = require("express");
const notasController = require("../controllers/notas.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /notas/minhas:
 *   get:
 *     summary: As notas do formando autenticado (só vê as suas)
 *     tags: [Notas]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de notas, com a UC e o formador }
 */
router.get("/minhas", requireRole("FORMANDO"), notasController.listarMinhas);

/**
 * @openapi
 * /notas/turma-uc/{turmaUcId}:
 *   get:
 *     summary: Formandos da turma desta UC, cada um com a nota lançada (só o formador responsável ou a coordenação)
 *     tags: [Notas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaUcId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Formandos e notas }
 *       403: { description: Não és o formador desta UC, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/turma-uc/:turmaUcId", requireRole("FORMADOR", "COORDENADOR"), notasController.listarDaTurmaUc);

/**
 * @openapi
 * /notas/turma-uc/{turmaUcId}/formando/{formandoId}:
 *   put:
 *     summary: Lança (ou atualiza) a nota de um formando nesta UC — escala 0 a 20
 *     tags: [Notas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: turmaUcId, in: path, required: true, schema: { type: integer } }
 *       - { name: formandoId, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [valor], properties: { valor: { type: number, minimum: 0, maximum: 20 }, observacoes: { type: string } } }
 *     responses:
 *       200: { description: Nota lançada }
 *       422: { description: Nota inválida ou formando que não pertence à turma, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.put("/turma-uc/:turmaUcId/formando/:formandoId", requireRole("FORMADOR", "COORDENADOR"), notasController.lancar);

/**
 * @openapi
 * /notas/turma-uc/{turmaUcId}/formando/{formandoId}/historico:
 *   get:
 *     summary: Histórico de alterações da nota de um formando nesta UC (auditoria; só o formador responsável ou a coordenação)
 *     tags: [Notas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: turmaUcId, in: path, required: true, schema: { type: integer } }
 *       - { name: formandoId, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista de alterações (valor anterior/novo, quem alterou, quando), a mais recente primeiro }
 *       403: { description: Não és o formador desta UC, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/turma-uc/:turmaUcId/formando/:formandoId/historico", requireRole("FORMADOR", "COORDENADOR"), notasController.historico);

/**
 * @openapi
 * /notas/pauta/turma/{turmaId}:
 *   get:
 *     summary: Pauta da turma — formandos x UCs com as notas (só coordenação)
 *     tags: [Notas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Pauta }
 */
router.get("/pauta/turma/:turmaId", requireRole("COORDENADOR"), notasController.pautaDaTurma);

module.exports = router;
