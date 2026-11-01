const { Router } = require("express");
const trabalhosController = require("../controllers/trabalhos.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadSubmissaoTrabalho } = require("../middleware/upload");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /trabalhos/minhas:
 *   get:
 *     summary: Os trabalhos da turma do formando, com a sua própria submissão e avaliação
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Trabalhos }
 */
router.get("/minhas", requireRole("FORMANDO"), trabalhosController.minhas);

/**
 * @openapi
 * /trabalhos/turma-uc/{turmaUcId}:
 *   get:
 *     summary: Trabalhos atribuídos numa UC de uma turma, com o nº de submissões (formador responsável ou coordenação)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaUcId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Trabalhos }
 */
router.get("/turma-uc/:turmaUcId", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.listarDaTurmaUc);

/**
 * @openapi
 * /trabalhos:
 *   post:
 *     summary: Atribui um trabalho (título, descrição e prazo) a uma UC de uma turma
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [turmaUcId, titulo, dataLimite], properties: { turmaUcId: { type: integer }, titulo: { type: string }, descricao: { type: string }, dataLimite: { type: string, format: date } } }
 *     responses:
 *       201: { description: Trabalho criado }
 */
router.post("/", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.criar);

/**
 * @openapi
 * /trabalhos/submissoes/{id}/avaliar:
 *   patch:
 *     summary: Avalia uma submissão (nota 0-20 opcional + feedback)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { avaliacao: { type: number, minimum: 0, maximum: 20 }, feedback: { type: string } } }
 *     responses:
 *       200: { description: Submissão avaliada }
 */
router.patch("/submissoes/:id/avaliar", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.avaliar);

/**
 * @openapi
 * /trabalhos/submissoes/{id}/ficheiro:
 *   get:
 *     summary: Descarrega o ficheiro de uma submissão (formando dono, formador responsável ou coordenação)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: O ficheiro }
 */
router.get("/submissoes/:id/ficheiro", trabalhosController.ficheiro);

/**
 * @openapi
 * /trabalhos/{id}:
 *   patch:
 *     summary: Edita um trabalho (título, descrição, prazo)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Trabalho atualizado }
 *   delete:
 *     summary: Desativa um trabalho (soft delete — as submissões mantêm-se)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Trabalho desativado }
 */
router.patch("/:id", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.atualizar);
router.delete("/:id", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.apagar);

/**
 * @openapi
 * /trabalhos/{id}/submissoes:
 *   get:
 *     summary: Formandos da turma com a submissão de cada um neste trabalho (formador responsável ou coordenação)
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Submissões }
 */
router.get("/:id/submissoes", requireRole("FORMADOR", "COORDENADOR"), trabalhosController.listarSubmissoes);

/**
 * @openapi
 * /trabalhos/{id}/submissao:
 *   post:
 *     summary: O formando submete (ou reenvia, até ao fim do prazo) o ficheiro do trabalho
 *     tags: [Trabalhos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, required: [ficheiro], properties: { ficheiro: { type: string, format: binary }, comentario: { type: string } } }
 *     responses:
 *       201: { description: Trabalho submetido }
 *       409: { description: Prazo ultrapassado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/:id/submissao", requireRole("FORMANDO"), uploadSubmissaoTrabalho.single("ficheiro"), trabalhosController.submeter);

module.exports = router;
