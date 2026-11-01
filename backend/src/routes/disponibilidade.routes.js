const { Router } = require("express");
const disponibilidadeController = require("../controllers/disponibilidade.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /disponibilidade/formador/{formadorId}:
 *   get:
 *     summary: Lista a disponibilidade de um formador específico (só coordenação, para agendar aulas)
 *     tags: [Disponibilidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: formadorId, in: path, required: true, schema: { type: integer } }
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Lista de blocos, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Disponibilidade' } } } } } } }
 */
router.get("/formador/:formadorId", requireRole("COORDENADOR"), disponibilidadeController.listarDeFormador);

/**
 * @openapi
 * /disponibilidade/pedir-marcacao:
 *   post:
 *     summary: Pede por email a um formador que marque disponibilidade em horas concretas (só coordenação)
 *     tags: [Disponibilidade]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [formadorId, quando], properties: { formadorId: { type: integer }, quando: { type: array, maxItems: 100, items: { type: string, example: "2030-04-16 09:00" } } } }
 *     responses:
 *       200: { description: "{ avisados, horas }" }
 *       404: { description: Formador não encontrado ou inativo, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/pedir-marcacao", requireRole("COORDENADOR"), disponibilidadeController.pedirMarcacao);

// A partir daqui, cada formador só gere a sua própria disponibilidade.
router.use(requireRole("FORMADOR"));

/**
 * @openapi
 * /disponibilidade:
 *   post:
 *     summary: Define ou atualiza um bloco de 1h da própria disponibilidade (só formador)
 *     tags: [Disponibilidade]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, horaInicio]
 *             properties:
 *               data: { type: string, format: date }
 *               horaInicio: { type: integer, minimum: 0, maximum: 23 }
 *               estado: { type: string, enum: [LIVRE, BLOQUEADO], default: LIVRE }
 *               motivo: { type: string, example: Almoço }
 *     responses:
 *       201: { description: Bloco definido, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Disponibilidade' } } } } } }
 */
router.post("/", disponibilidadeController.definirBloco);

/**
 * @openapi
 * /disponibilidade/minha:
 *   get:
 *     summary: Lista a própria disponibilidade (só formador)
 *     tags: [Disponibilidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Lista de blocos, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Disponibilidade' } } } } } } }
 */
router.get("/minha", disponibilidadeController.listarMinha);

/**
 * @openapi
 * /disponibilidade/{id}:
 *   delete:
 *     summary: Apaga um bloco da própria disponibilidade, se ainda não tiver aula agendada (só formador)
 *     tags: [Disponibilidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Bloco apagado }
 *       403: { description: Bloco não pertence ao formador autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Bloco já tem aula agendada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.delete("/:id", disponibilidadeController.apagar);

module.exports = router;
