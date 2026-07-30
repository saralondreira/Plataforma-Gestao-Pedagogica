const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/AppError");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "UNAUTHORIZED", "Token em falta ou inválido."));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role }
    next();
  } catch (error) {
    next(new AppError(401, "UNAUTHORIZED", "Token expirado ou inválido."));
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
