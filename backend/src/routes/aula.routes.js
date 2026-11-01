const { Router } = require("express");
const aulaController = require("../controllers/aula.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /aulas/turma-uc/{turmaUcId}:
 *   get:
 *     summary: Lista as aulas agendadas de uma UC numa turma
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaUcId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Lista de aulas, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Aula' } } } } } } }
 */
router.get("/turma-uc/:turmaUcId", aulaController.listarPorTurmaUc);

/**
 * @openapi
 * /aulas/minhas:
 *   get:
 *     summary: O meu horário — formador - as aulas que dá; formando - as aulas da sua turma
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Aulas por ordem cronológica (formando sem turma - lista vazia) }
 *       403: { description: Só formadores e formandos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/minhas", requireRole("FORMADOR", "FORMANDO"), aulaController.listarMinhas);

/**
 * @openapi
 * /aulas/turma/{turmaId}:
 *   get:
 *     summary: Horário da turma — todas as aulas de todas as UCs, com UC e formador (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: turmaId, in: path, required: true, schema: { type: integer } }
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Aulas da turma por ordem cronológica }
 *       404: { description: Turma não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/turma/:turmaId", requireRole("COORDENADOR"), aulaController.listarPorTurma);

// A partir daqui, só a coordenação agenda/cancela aulas.
router.use(requireRole("COORDENADOR"));

/**
 * @openapi
 * /aulas:
 *   post:
 *     summary: Agenda uma aula num bloco livre do formador responsável pela UC nesta turma (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [turmaUcId, disponibilidadeId, modalidade]
 *             properties:
 *               turmaUcId: { type: integer }
 *               disponibilidadeId: { type: integer }
 *               modalidade: { type: string, enum: [PRESENCIAL, ONLINE] }
 *     responses:
 *       201: { description: Aula agendada, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Aula' } } } } } }
 *       409: { description: Bloco ocupado/bloqueado, ou carga horária da UC excedida, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Bloco não pertence ao formador desta UC nesta turma, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/", aulaController.criar);

/**
 * @openapi
 * /aulas/{id}:
 *   delete:
 *     summary: Cancela uma aula agendada, libertando o bloco de disponibilidade (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Aula cancelada }
 *       404: { description: Aula não encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
/**
 * @openapi
 * /aulas/{id}/reagendar:
 *   patch:
 *     summary: Muda uma aula futura para outro bloco livre do mesmo formador (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [disponibilidadeId], properties: { disponibilidadeId: { type: integer }, modalidade: { type: string, enum: [PRESENCIAL, ONLINE] } } }
 *     responses:
 *       200: { description: Aula reagendada }
 *       409: { description: Bloco bloqueado/ocupado ou turma ocupada nessa hora, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Aula já passada, bloco removido ou de outro formador, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
/**
 * @openapi
 * /aulas/lote:
 *   post:
 *     summary: Agenda várias aulas de uma vez, uma por bloco livre (só coordenação)
 *     description: Não é tudo-ou-nada — cada aula passa pelas regras do agendamento normal; as que falham são devolvidas com o motivo e não impedem as restantes.
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [turmaUcId, disponibilidadeIds, modalidade], properties: { turmaUcId: { type: integer }, disponibilidadeIds: { type: array, items: { type: integer }, maxItems: 60 }, modalidade: { type: string, enum: [PRESENCIAL, ONLINE] } } }
 *     responses:
 *       201: { description: "{ criadas: n, falhadas: [{ disponibilidadeId, codigo, motivo }] }" }
 *       422: { description: Dados inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/lote", aulaController.criarLote);

/**
 * @openapi
 * /aulas/repetir-semana:
 *   post:
 *     summary: Repete as aulas de uma semana da turma nas N semanas seguintes (só coordenação)
 *     description: Mesmo dia da semana, hora, UC e formador. Cada aula passa pelas regras normais (o formador tem de ter o bloco livre nessa hora); as que falham vêm com o motivo e não impedem as outras. A semana é a que contém `semanaDe`.
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [turmaId, semanaDe, numSemanas], properties: { turmaId: { type: integer }, semanaDe: { type: string, format: date }, numSemanas: { type: integer, minimum: 1, maximum: 16 } } }
 *     responses:
 *       201: { description: "{ aulasNaSemana, criadas, falhadas: [{ quando, codigo, motivo }] }" }
 *       422: { description: Semana sem aulas ou dados inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/repetir-semana", aulaController.repetirSemana);

router.patch("/:id/reagendar", aulaController.reagendar);

/**
 * @openapi
 * /aulas/relatorio-formadores:
 *   get:
 *     summary: Relatório de horas por formador — dadas, por dar, detalhe por UC/turma e blocos de disponibilidade (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Um item por formador ativo }
 */
router.get("/relatorio-formadores", aulaController.relatorioHoras);

/**
 * @openapi
 * /aulas:
 *   get:
 *     summary: Horário geral — aulas de todas as turmas, filtráveis por datas, turma e formador (só coordenação)
 *     tags: [Aulas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: de, in: query, schema: { type: string, format: date } }
 *       - { name: ate, in: query, schema: { type: string, format: date } }
 *       - { name: turmaId, in: query, schema: { type: integer } }
 *       - { name: formadorId, in: query, schema: { type: integer } }
 *     responses:
 *       200: { description: Aulas por ordem cronológica, com UC, formador e turma }
 */
router.get("/", aulaController.listarGeral);

router.delete("/:id", aulaController.cancelar);

module.exports = router;
