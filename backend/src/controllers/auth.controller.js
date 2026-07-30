const { z } = require("zod");
const authService = require("../services/auth.service");

const registerSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
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
    res.json({ data: resultado });
  } catch (error) {
    next(error);
  }
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

module.exports = { register, login, me, updateMe, registerSchema, loginSchema, updateMeSchema };
