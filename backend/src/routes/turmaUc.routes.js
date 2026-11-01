const { Router } = require("express");
const turmaUcController = require("../controllers/turmaUc.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /turma-ucs/turma/{turmaId}:
 *   get:
 *     summary: Lista as UCs associadas a uma turma, com formador e horas dadas/em falta
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Lista de associações Turma/UC, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/TurmaUC' } } } } } } }
 */
router.get("/turma/:turmaId", turmaUcController.listarPorTurma);

/**
 * @openapi
 * /turma-ucs/minhas:
 *   get:
 *     summary: As UCs que o formador autenticado leciona (turma + UC), para escolher nas páginas de notas, assiduidade e trabalhos
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Associações Turma/UC do formador }
 */
router.get("/minhas", requireRole("FORMADOR"), turmaUcController.minhas);

// A partir daqui, só a coordenação associa/edita/remove UCs de turmas.
router.use(requireRole("COORDENADOR"));

/**
 * @openapi
 * /turma-ucs:
 *   post:
 *     summary: Associa uma UC do catálogo a uma turma, com formador atribuído (só coordenação)
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [turmaId, ucId, formadorId]
 *             properties:
 *               turmaId: { type: integer }
 *               ucId: { type: integer }
 *               formadorId: { type: integer }
 *     responses:
 *       201: { description: UC associada à turma, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/TurmaUC' } } } } } }
 *       409: { description: UC já associada a esta turma, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Formador inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", turmaUcController.associar);

/**
 * @openapi
 * /turma-ucs/copiar:
 *   post:
 *     summary: Copia as UCs ativas de uma turma para outra, com os mesmos formadores (só coordenação)
 *     description: Copia só a estrutura (não aulas, notas nem trabalhos). Ignora UCs já associadas ao destino, desativadas no catálogo ou com formador inativo, e devolve a lista do que foi copiado e do que foi ignorado.
 *     tags: [Turma UCs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [origemTurmaId, destinoTurmaId], properties: { origemTurmaId: { type: integer }, destinoTurmaId: { type: integer } } }
 *     responses:
 *       201: { description: "{ copiadas: [abreviaturas], ignoradas: [{ uc, motivo }] }" }
 *       404: { description: Turma não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Turmas iguais ou destino inativo, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/copiar", turmaUcController.copiar);

/**
 * @openapi
 * /turma-ucs/{id}:
 *   patch:
 *     summary: Muda o formador atribuído a uma UC de uma turma (só coordenação)
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Associação atualizada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/TurmaUC' } } } } } }
 *       404: { description: Associação não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   delete:
 *     summary: Desativa a associação de uma UC a uma turma (soft delete — mantém as aulas já dadas; deixa de aceitar novas aulas)
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Associação desativada }
 *       404: { description: Associação não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
/**
 * @openapi
 * /turma-ucs/{id}/substituir-formador:
 *   patch:
 *     summary: Substitui o formador de uma UC numa turma, passando as aulas futuras para o novo formador (só coordenação)
 *     description: As aulas futuras mudam para blocos livres do novo formador na mesma data e hora; as passadas mantêm-se. Se faltar bloco livre para alguma, recusa (409 SEM_BLOCOS_LIVRES) sem alterar nada — a não ser que cancelarSemBloco seja true, caso em que essas aulas são canceladas.
 *     tags: [Turma UCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [formadorId], properties: { formadorId: { type: integer }, cancelarSemBloco: { type: boolean, default: false } } }
 *     responses:
 *       200: { description: "{ turmaUc, movidas, canceladas }" }
 *       409: { description: SEM_BLOCOS_LIVRES, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Formador inválido/inativo/igual ou associação inativa, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/substituir-formador", turmaUcController.substituirFormador);

router.patch("/:id", turmaUcController.atualizar);
router.delete("/:id", turmaUcController.remover);

/**
 * @openapi
 * /turma-ucs/{id}/reativar:
 *   patch:
 *     summary: Reativa uma associação Turma/UC desativada (só coordenação)
 *     tags: [TurmaUCs]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Associação reativada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/TurmaUC' } } } } } }
 *       404: { description: Associação não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/reativar", turmaUcController.reativar);

module.exports = router;
