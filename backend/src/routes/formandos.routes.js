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

/**
 * @openapi
 * /formandos:
 *   post:
 *     summary: Cria a conta de um formando (só coordenação)
 *     description: >
 *       Cria a conta diretamente, sem passar por um Pedido de Acesso. Se já existiu um formando
 *       inativo com o mesmo email, essa conta é reativada (o histórico mantém-se).
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, password]
 *             properties:
 *               nome: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               turmaId: { type: integer, nullable: true }
 *     responses:
 *       201: { description: Formando criado }
 *       404: { description: Turma não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Email já em uso, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Dados inválidos ou turma inativa, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", formandosController.criar);

/**
 * @openapi
 * /formandos/{id}:
 *   patch:
 *     summary: Edita o nome, o email e/ou a turma de um formando (só coordenação)
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string }
 *               email: { type: string, format: email }
 *               turmaId: { type: integer, nullable: true }
 *     responses:
 *       200: { description: Formando atualizado }
 *       404: { description: Formando ou turma não encontrados, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Email já em uso, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   delete:
 *     summary: Desativa a conta de um formando (só coordenação)
 *     description: Não apaga, só marca como inativa (o histórico de notas, presenças e entregas mantém-se). Ver /reativar.
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Formando desativado }
 *       404: { description: Formando não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id", formandosController.atualizar);
router.delete("/:id", formandosController.desativar);

/**
 * @openapi
 * /formandos/{id}/reativar:
 *   patch:
 *     summary: Reativa a conta de um formando desativado (só coordenação)
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Formando reativado }
 *       404: { description: Formando não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/reativar", formandosController.reativar);

/**
 * @openapi
 * /formandos/{id}/password:
 *   patch:
 *     summary: Repõe a palavra-passe de um formando (só coordenação)
 *     description: As sessões abertas desse formando deixam de valer.
 *     tags: [Formandos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       204: { description: Palavra-passe reposta }
 *       404: { description: Formando não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Palavra-passe inválida, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/password", formandosController.reporPassword);

module.exports = router;
