const { Router } = require("express");
const calendarioController = require("../controllers/calendario.controller");
const { requireAuth } = require("../middleware/auth");
const { limitadorCalendario } = require("../middleware/rateLimit");

const router = Router();

/**
 * @openapi
 * /calendario/link:
 *   post:
 *     summary: Gera o link de subscrição de calendário (.ics) do utilizador autenticado
 *     description: O link serve para "adicionar calendário por URL" no Google Calendar, Outlook ou Apple Calendar. Dá acesso só de leitura ao horário do próprio utilizador e deixa de funcionar se mudar a password ou a conta for desativada. Quem tiver o link vê o horário — tratar como privado.
 *     tags: [Calendário]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ url }" }
 */
router.post("/link", requireAuth, calendarioController.criarLink);

/**
 * @openapi
 * /calendario/feed.ics:
 *   get:
 *     summary: Calendário .ics (rota pública, protegida pelo token do link)
 *     tags: [Calendário]
 *     parameters: [{ name: t, in: query, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Ficheiro text/calendar com as aulas (30 dias atrás a 12 meses à frente) }
 *       404: { description: Link inválido, expirado por mudança de password ou conta desativada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/feed.ics", limitadorCalendario, calendarioController.feed);

module.exports = router;
