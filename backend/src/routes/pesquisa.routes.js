const { Router } = require("express");
const pesquisaController = require("../controllers/pesquisa.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

/**
 * @openapi
 * /pesquisa:
 *   get:
 *     summary: Pesquisa global — turmas, formadores, formandos e UCs ativos (só coordenação)
 *     tags: [Pesquisa]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: q, in: query, required: true, schema: { type: string, minLength: 2 } }]
 *     responses:
 *       200: { description: "{ termo, turmas, formadores, formandos, ucs } (máx. 8 por tipo)" }
 *       422: { description: Termo com menos de 2 letras, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/", requireAuth, requireRole("COORDENADOR"), pesquisaController.pesquisar);

module.exports = router;
