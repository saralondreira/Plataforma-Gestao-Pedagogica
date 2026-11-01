const { Router } = require("express");
const comunicadosController = require("../controllers/comunicados.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /comunicados:
 *   post:
 *     summary: Envia um comunicado a todos os formandos de uma turma (mediador da turma ou coordenação)
 *     tags: [Comunicados]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [turmaId, assunto, corpo], properties: { turmaId: { type: integer }, assunto: { type: string }, corpo: { type: string } } }
 *     responses:
 *       201: { description: Comunicado criado (com o número de destinatários) }
 * /comunicados/enviados:
 *   get:
 *     summary: Comunicados enviados (mediador - das suas turmas; coordenação - todos)
 *     tags: [Comunicados]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de comunicados }
 * /comunicados/turmas:
 *   get:
 *     summary: Turmas a que o utilizador pode enviar comunicados
 *     tags: [Comunicados]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de turmas }
 * /comunicados/turma:
 *   get:
 *     summary: Comunicados da turma do formando
 *     tags: [Comunicados]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de comunicados }
 * /comunicados/{id}:
 *   delete:
 *     summary: Remove um comunicado (autor, mediador da turma ou coordenação)
 *     tags: [Comunicados]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Removido }
 */
router.post("/", requireRole("FORMADOR", "COORDENADOR"), comunicadosController.enviar);
router.get("/enviados", requireRole("FORMADOR", "COORDENADOR"), comunicadosController.enviados);
router.get("/turmas", requireRole("FORMADOR", "COORDENADOR"), comunicadosController.turmasEnvio);
router.get("/turma", requireRole("FORMANDO"), comunicadosController.daTurma);
router.delete("/:id", requireRole("FORMADOR", "COORDENADOR"), comunicadosController.remover);

module.exports = router;
