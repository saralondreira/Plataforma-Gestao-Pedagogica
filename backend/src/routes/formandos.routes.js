const { Router } = require("express");
const formandosController = require("../controllers/formandos.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

// Só a coordenação — ao contrário de /formadores (leitura aberta), a lista
// de formandos é informação mais sensível e não há hoje nenhum outro papel
// que precise de a consultar.
router.use(requireAuth, requireRole("COORDENADOR"));

/**
 * @openapi
 * /formandos:
 *   get:
 *     summary: Lista os utilizadores com role=FORMANDO, com a turma atual (só coordenação)
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: incluirInativos, in: query, schema: { type: boolean }, description: "Por omissão só mostra contas ativas." }
 *     responses:
 *       200: { description: Lista de formandos, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Utilizador' } } } } } } }
 *       403: { description: Só a coordenação pode listar formandos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/", formandosController.listar);

/**
 * @openapi
 * /formandos/{id}/turma:
 *   patch:
 *     summary: Muda (ou remove) a turma de um formando, depois de a conta já existir (só coordenação)
 *     description: >
 *       Cobre o caso de mudar a turma DEPOIS de a conta já existir (ex.: mudou de turma a
 *       meio do curso, ou ainda não tinha turma atribuída na aprovação do Pedido de Acesso).
 *       A primeira atribuição continua a poder ser feita logo na aprovação do pedido.
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [turmaId]
 *             properties:
 *               turmaId: { type: integer, nullable: true, description: "null para remover o formando de qualquer turma." }
 *     responses:
 *       200: { description: Formando atualizado, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } } } } }
 *       404: { description: Formando ou turma não encontrados, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Turma inativa, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/turma", formandosController.atualizarTurma);

module.exports = router;
