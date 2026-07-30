const { Router } = require("express");
const formadoresController = require("../controllers/formadores.controller");
const { requireAuth } = require("../middleware/auth");

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
router.post("/", formadoresController.criar);

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
 *     summary: Apaga um formador (remove a conta)
 *     tags: [Formadores]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Formador apagado }
 *       404: { description: Formador não encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.patch("/:id", formadoresController.atualizar);
router.delete("/:id", formadoresController.apagar);

module.exports = router;
