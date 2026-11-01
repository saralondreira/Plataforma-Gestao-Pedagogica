const { z } = require("zod");
const { passwordNova } = require("../lib/validacao");
const authService = require("../services/auth.service");
const { guardarSessao, limparSessao, VALOR_CSRF } = require("../lib/cookieSessao");

const registerSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: passwordNova,
  role: z.enum(["COORDENADOR", "FORMADOR"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function register(req, res, next) {
  try {
    const dados = registerSchema.parse(req.body);
    const user = await authService.register(dados);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const dados = loginSchema.parse(req.body);
    const resultado = await authService.login(dados);
    guardarSessao(res, resultado.token);
    // O frontend do browser identifica-se com X-Requested-With e nunca vê o token: só o cookie httpOnly o guarda.
    if (req.get("x-requested-with") === VALOR_CSRF) {
      const { token, ...semToken } = resultado;
      return res.json({ data: semToken });
    }
    res.json({ data: resultado });
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  limparSessao(res);
  res.status(204).send();
}

async function me(req, res, next) {
  try {
    const user = await authService.getById(req.user.id);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

const updateMeSchema = z.object({
  nome: z.string().min(2).optional(),
  contacto: z.string().optional(),
  linkedin: z.string().optional(),
  competencias: z.string().optional(),
});

async function updateMe(req, res, next) {
  try {
    const dados = updateMeSchema.parse(req.body);
    const user = await authService.updateProfile(req.user.id, dados);
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
}

const pedirRecuperacaoSchema = z.object({ email: z.string().email() });
const redefinirSchema = z.object({ token: z.string().min(10), password: passwordNova });

async function esqueciPassword(req, res, next) {
  try {
    const { email } = pedirRecuperacaoSchema.parse(req.body);
    await authService.pedirRecuperacao(email);
    res.json({ data: { mensagem: "Se o email existir na plataforma, enviámos instruções para redefinir a palavra-passe." } });
  } catch (error) {
    next(error);
  }
}

async function redefinirPassword(req, res, next) {
  try {
    const { token, password } = redefinirSchema.parse(req.body);
    await authService.redefinirPassword(token, password);
    res.json({ data: { mensagem: "Palavra-passe alterada. Já podes entrar." } });
  } catch (error) {
    next(error);
  }
}

module.exports = { esqueciPassword, redefinirPassword, register, login, me, updateMe, registerSchema, loginSchema, updateMeSchema, logout };
