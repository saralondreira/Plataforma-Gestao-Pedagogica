const { Router } = require("express");
const sumariosController = require("../controllers/sumarios.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /sumarios/por-escrever:
 *   get:
 *     summary: Aulas já dadas do formador sem sumário (ou com o sumário rejeitado)
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de aulas por escrever, com o sumário rejeitado e o motivo, se houver }
 */
router.get("/por-escrever", requireRole("FORMADOR"), sumariosController.porEscrever);

/**
 * @openapi
 * /sumarios/meus:
 *   get:
 *     summary: Os sumários escritos pelo formador, com o estado (submetido/validado/rejeitado)
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de sumários }
 */
router.get("/meus", requireRole("FORMADOR"), sumariosController.doFormador);

/**
 * @openapi
 * /sumarios/por-validar:
 *   get:
 *     summary: Sumários à espera de validação — todos para a coordenação; só os das suas turmas para o mediador
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de sumários submetidos (vazia para um formador que não é mediador) }
 */
router.get("/por-validar", requireRole("FORMADOR", "COORDENADOR"), sumariosController.porValidar);

/**
 * @openapi
 * /sumarios/turma:
 *   get:
 *     summary: Os sumários validados da turma do formando
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de sumários validados, do mais recente para o mais antigo }
 */
router.get("/turma", requireRole("FORMANDO"), sumariosController.daTurmaDoFormando);

/**
 * @openapi
 * /sumarios/aula/{aulaId}:
 *   get:
 *     summary: O sumário de uma aula (ou null) — formador responsável, mediador da turma ou coordenação
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: aulaId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Sumário ou null }
 *       403: { description: Sem permissão, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   put:
 *     summary: Escreve (ou corrige) o sumário de uma aula já dada — formador responsável ou coordenação
 *     description: Fica SUBMETIDO e o mediador da turma (ou a coordenação, se não houver) recebe um aviso. Um sumário VALIDADO já não se altera; um REJEITADO corrige-se e volta a ser submetido.
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: aulaId, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [texto], properties: { texto: { type: string, minLength: 10, maxLength: 5000 } } }
 *     responses:
 *       200: { description: Sumário submetido }
 *       409: { description: Já validado (SUMARIO_VALIDADO), content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Aula ainda não aconteceu (AULA_FUTURA) ou texto inválido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/aula/:aulaId", requireRole("FORMADOR", "COORDENADOR"), sumariosController.daAula);
router.put("/aula/:aulaId", requireRole("FORMADOR", "COORDENADOR"), sumariosController.registar);

/**
 * @openapi
 * /sumarios/{id}/decidir:
 *   patch:
 *     summary: Valida ou rejeita um sumário — mediador da turma ou coordenação
 *     tags: [Sumários]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [aceite], properties: { aceite: { type: boolean }, nota: { type: string, description: "Obrigatória ao rejeitar" } } }
 *     responses:
 *       200: { description: Sumário decidido; o formador é avisado }
 *       403: { description: Não és o mediador desta turma, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       409: { description: Já decidido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Falta o motivo da rejeição, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/decidir", requireRole("FORMADOR", "COORDENADOR"), sumariosController.decidir);

module.exports = router;
