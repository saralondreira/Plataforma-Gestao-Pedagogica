const { Router } = require("express");
const formadoresController = require("../controllers/formadores.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /formadores:
 *   get:
 *     summary: Lista os utilizadores com role=FORMADOR
 *     tags: [Formadores]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de formadores, content: { application/json: { schema: { type: object, properties: { data: { type: array, items: { $ref: '#/components/schemas/Utilizador' } } } } } } }
 *   post:
 *     summary: Cria um formador (cria também a conta de login)
 *     tags: [Formadores]
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
 *               password: { type: string, minLength: 6 }
 *               sigla: { type: string }
 *               turmasQtd: { type: integer }
 *               ucsQtd: { type: integer }
 *               estadoFormador: { type: string, enum: [ATIVO, INATIVO] }
 *     responses:
 *       201: { description: Formador criado, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } } } } }
 *       409: { description: Email já em uso, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.get("/", formadoresController.listar);
router.post("/", requireRole("COORDENADOR"), formadoresController.criar);

/**
 * @openapi
 * /formadores/{id}:
 *   patch:
 *     summary: Atualiza a ficha de um formador (não altera credenciais)
 *     tags: [Formadores]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Campos parciais: nome, sigla, turmasQtd, ucsQtd, estadoFormador" }
 *     responses:
 *       200: { description: Formador atualizado, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } } } } }
 *       404: { description: Formador não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   delete:
 *     summary: Desativa um formador (soft delete — a conta e o histórico mantêm-se, deixa de poder fazer login e some das listagens)
 *     tags: [Formadores]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Formador desativado }
 *       404: { description: Formador não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id", requireRole("COORDENADOR"), formadoresController.atualizar);
router.delete("/:id", requireRole("COORDENADOR"), formadoresController.apagar);

/**
 * @openapi
 * /formadores/{id}/reativar:
 *   patch:
 *     summary: Reativa um formador desativado
 *     tags: [Formadores]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: Formador reativado, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } } } } }
 *       404: { description: Formador não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id/reativar", requireRole("COORDENADOR"), formadoresController.reativar);

module.exports = router;
