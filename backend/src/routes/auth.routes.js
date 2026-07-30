const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Regista um novo utilizador (coordenador ou formador)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, password, role]
 *             properties:
 *               nome: { type: string, minLength: 2 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [COORDENADOR, FORMADOR] }
 *     responses:
 *       201:
 *         description: Utilizador criado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties: { data: { $ref: '#/components/schemas/Utilizador' } }
 *       409: { description: Email já em uso, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *       422: { description: Dados inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/register", authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica um utilizador e devolve um JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login efetuado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     user: { $ref: '#/components/schemas/Utilizador' }
 *       401: { description: Credenciais inválidas, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 */
router.post("/login", authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Devolve os dados do utilizador autenticado
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dados do utilizador
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } }
 *       401: { description: Sem token válido, content: { application/json: { schema: { $ref: '#/components/schemas/Erro' } } } }
 *   patch:
 *     summary: Atualiza o perfil do utilizador autenticado (o role não é editável por esta via)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string }
 *               contacto: { type: string }
 *               linkedin: { type: string }
 *               competencias: { type: string }
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { data: { $ref: '#/components/schemas/Utilizador' } } }
 */
router.get("/me", requireAuth, authController.me);
router.patch("/me", requireAuth, authController.updateMe);

module.exports = router;
