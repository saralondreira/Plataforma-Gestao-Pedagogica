const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth, requireRole } = require("../middleware/auth");
const { limitadorLogin, limitadorRecuperacao, limitadorRedefinicao } = require("../middleware/rateLimit");

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Regista um novo utilizador (coordenador ou formador) — só um coordenador autenticado pode criar contas por aqui
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
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
router.post("/register", requireAuth, requireRole("COORDENADOR"), authController.register);

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
router.post("/login", limitadorLogin, authController.login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Termina a sessão (apaga o cookie httpOnly da sessão)
 *     tags: [Auth]
 *     responses:
 *       204: { description: Sessão terminada }
 */
router.post("/logout", authController.logout);

/**
 * @openapi
 * /auth/esqueci-password:
 *   post:
 *     summary: Pede um email para redefinir a palavra-passe (resposta igual exista ou não a conta)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [email], properties: { email: { type: string, format: email } } }
 *     responses:
 *       200: { description: Pedido registado }
 * /auth/redefinir-password:
 *   post:
 *     summary: Define uma nova palavra-passe com o token recebido por email (válido 1 hora, uso único)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [token, password], properties: { token: { type: string }, password: { type: string, minLength: 6 } } }
 *     responses:
 *       200: { description: Palavra-passe alterada }
 *       400: { description: Token inválido ou expirado }
 */
router.post("/esqueci-password", limitadorRecuperacao, authController.esqueciPassword);
router.post("/redefinir-password", limitadorRedefinicao, authController.redefinirPassword);

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
