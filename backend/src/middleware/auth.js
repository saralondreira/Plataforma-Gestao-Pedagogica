const jwt = require("jsonwebtoken");
const { impressaoDaPassword } = require("../lib/sessao");
const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");
const { lerCookie, pedidoPorCookieEValido } = require("../lib/cookieSessao");

async function requireAuth(req, res, next) {
  try {
    // Clientes de API enviam "Authorization: Bearer"; o browser envia o cookie httpOnly da sessão.
    const header = req.headers.authorization || "";
    const [scheme, tokenDoCabecalho] = header.split(" ");
    let token = scheme === "Bearer" ? tokenDoCabecalho : null;

    if (!token) {
      token = lerCookie(req);
      if (token && !pedidoPorCookieEValido(req)) {
        throw new AppError(403, "CSRF_INVALIDO", "Pedido recusado: origem ou cabeçalho de segurança inválido.");
      }
    }

    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "Token em falta ou inválido.");
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new AppError(401, "UNAUTHORIZED", "Token expirado ou inválido.");
    }

    // Confirma na base de dados que a conta ainda está ativa — um token já
    // emitido não fica válido para sempre só porque ainda não expirou (7
    // dias): se a conta foi desativada entretanto (flag ativo=false), o
    // acesso é cortado já no pedido seguinte. Express 4 não apanha rejeições
    // de promises automaticamente, por isso este pedido à BD tem de estar
    // dentro do try/catch exterior.
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { ativo: true, passwordHash: true, role: true } });
    if (!user || !user.ativo) {
      throw new AppError(403, "CONTA_INATIVA", "Esta conta foi desativada.");
    }

    // A sessão só vale enquanto a palavra-passe for a mesma com que foi iniciada.
    if (payload.ph !== impressaoDaPassword(user.passwordHash)) {
      throw new AppError(401, "SESSAO_INVALIDA", "A sessão já não é válida — inicia sessão novamente.");
    }

    req.user = { id: payload.id, role: user.role }; // o papel vem da BD: mudar de papel tem efeito imediato
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "Não tens permissão para esta ação."));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
