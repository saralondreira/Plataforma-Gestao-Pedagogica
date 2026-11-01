const { Router } = require("express");
const painelService = require("../services/painel.service");
const conformidadeService = require("../services/conformidade.service");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /painel/resumo:
 *   get:
 *     summary: Resumo para o dashboard do utilizador autenticado (muda conforme o papel)
 *     description: |
 *       Formador - estado de cada UC que leciona (horas, notas lançadas, trabalhos), justificações por decidir, submissões por avaliar e próximas aulas.
 *       Formando - média, faltas (injustificadas), justificações pendentes e trabalhos por entregar.
 *       Coordenação - pedidos de acesso, justificações e mensagens por tratar, e formandos com muitas faltas injustificadas.
 *     tags: [Painel]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumo do painel }
 */
router.get("/resumo", async (req, res, next) => {
  try {
    res.json({ data: await painelService.resumo(req.user) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /painel/conformidade:
 *   get:
 *     summary: Semáforos de conformidade por UC (sumários, documentos, horário). Coordenação vê todas; o formador só as suas.
 *     tags: [Painel]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Totais por cor e lista de UCs, pior primeiro }
 */
router.get("/conformidade", requireRole("COORDENADOR", "FORMADOR"), async (req, res, next) => {
  try {
    res.json({ data: await conformidadeService.calcular(req.user) });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /painel/conformidade/avisar:
 *   post:
 *     summary: Avisa por email os formadores das UCs a vermelho (só coordenação)
 *     tags: [Painel]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Quantos formadores e UCs foram avisados }
 */
router.post("/conformidade/avisar", requireRole("COORDENADOR"), async (req, res, next) => {
  try {
    res.json({ data: await conformidadeService.avisarFormadoresEmFalha() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
