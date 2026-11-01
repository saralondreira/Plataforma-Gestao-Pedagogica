const { Router } = require("express");
const documentosController = require("../controllers/documentos.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadDocumentoUc } = require("../middleware/upload");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /documentos/turma:
 *   get:
 *     summary: Documentos ativos de todas as UCs da turma do formando
 *     tags: [Documentos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de documentos }
 */
router.get("/turma", requireRole("FORMANDO"), documentosController.daTurmaDoFormando);

/**
 * @openapi
 * /documentos/turma-uc/{turmaUcId}:
 *   get:
 *     summary: Documentos de uma UC numa turma (responsável, coordenação, mediador, formandos da turma). "?historico=1" inclui os removidos (responsável e coordenação).
 *     tags: [Documentos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaUcId, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Lista de documentos }
 *   post:
 *     summary: Envia um documento para o repositório da UC (responsável ou coordenação). O nome oficial é IDCurso_UC_Data.ext
 *     tags: [Documentos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: turmaUcId, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, required: [ficheiro], properties: { ficheiro: { type: string, format: binary }, categoria: { type: string, enum: [MATERIAL, PLANO, AVALIACAO, OUTRO] } } }
 *     responses:
 *       201: { description: Documento criado }
 */
router.get("/turma-uc/:turmaUcId", documentosController.listarDaTurmaUc);
router.post("/turma-uc/:turmaUcId", requireRole("FORMADOR", "COORDENADOR"), uploadDocumentoUc.single("ficheiro"), documentosController.enviar);

/**
 * @openapi
 * /documentos/{id}/ficheiro:
 *   get:
 *     summary: Descarrega o ficheiro (com o nome oficial)
 *     tags: [Documentos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: O ficheiro }
 * /documentos/{id}:
 *   delete:
 *     summary: Remove (esconde) um documento — fica no histórico
 *     tags: [Documentos]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Documento removido }
 */
router.get("/:id/ficheiro", documentosController.ficheiro);
router.delete("/:id", requireRole("FORMADOR", "COORDENADOR"), documentosController.remover);

module.exports = router;
