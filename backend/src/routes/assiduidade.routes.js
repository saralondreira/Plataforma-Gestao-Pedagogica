const { Router } = require("express");
const assiduidadeController = require("../controllers/assiduidade.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadJustificacao } = require("../middleware/upload");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /assiduidade/minhas:
 *   get:
 *     summary: As presenças, faltas e justificações do formando autenticado, com resumo
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumo e lista de aulas da turma com a presença de cada uma }
 */
router.get("/minhas", requireRole("FORMANDO"), assiduidadeController.minhas);

/**
 * @openapi
 * /assiduidade/aula/{aulaId}:
 *   get:
 *     summary: Formandos da turma desta aula com a presença registada (só o formador responsável ou a coordenação)
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: aulaId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Formandos, presenças e justificações }
 *   put:
 *     summary: Regista as presenças/faltas de uma aula (só depois de a aula acontecer)
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: aulaId, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [presencas]
 *             properties:
 *               presencas:
 *                 type: array
 *                 items: { type: object, properties: { formandoId: { type: integer }, estado: { type: string, enum: [PRESENTE, AUSENTE] } } }
 *     responses:
 *       200: { description: Presenças registadas }
 *       422: { description: Aula futura ou formando fora da turma, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/aula/:aulaId", requireRole("FORMADOR", "COORDENADOR"), assiduidadeController.listarDaAula);
router.put("/aula/:aulaId", requireRole("FORMADOR", "COORDENADOR"), assiduidadeController.registar);

/**
 * @openapi
 * /assiduidade/justificacoes:
 *   post:
 *     summary: O formando justifica uma falta (motivo + anexo opcional) — só faltas já registadas
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [aulaId, motivo]
 *             properties:
 *               aulaId: { type: integer }
 *               motivo: { type: string }
 *               anexo: { type: string, format: binary }
 *     responses:
 *       201: { description: Justificação submetida (fica pendente) }
 *       409: { description: Já submeteste uma justificação para esta falta, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   get:
 *     summary: Lista justificações (formador vê as das suas UCs; coordenação vê todas). Filtro opcional ?estado=PENDENTE
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Justificações }
 */
router.post("/justificacoes", requireRole("FORMANDO"), uploadJustificacao.single("anexo"), assiduidadeController.submeterJustificacao);
router.get("/justificacoes", requireRole("FORMADOR", "COORDENADOR"), assiduidadeController.listarJustificacoes);

/**
 * @openapi
 * /assiduidade/justificacoes/{id}/decidir:
 *   patch:
 *     summary: Aceita ou rejeita uma justificação pendente (formador responsável ou coordenação)
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [estado], properties: { estado: { type: string, enum: [ACEITE, REJEITADA] }, notaDecisao: { type: string } } }
 *     responses:
 *       200: { description: Justificação decidida }
 *       409: { description: Já decidida, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/justificacoes/:id/decidir", requireRole("FORMADOR", "COORDENADOR"), assiduidadeController.decidir);

/**
 * @openapi
 * /assiduidade/justificacoes/{id}/anexo:
 *   get:
 *     summary: Descarrega o anexo de uma justificação (formando dono, formador responsável ou coordenação)
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: O ficheiro }
 */
router.get("/justificacoes/:id/anexo", assiduidadeController.anexo);

/**
 * @openapi
 * /assiduidade/turma/{turmaId}/resumo:
 *   get:
 *     summary: Resumo de assiduidade por formando numa turma (só coordenação)
 *     tags: [Assiduidade]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Aulas dadas e presenças/faltas por formando }
 */
router.get("/turma/:turmaId/resumo", requireRole("COORDENADOR"), assiduidadeController.resumoDaTurma);

module.exports = router;
