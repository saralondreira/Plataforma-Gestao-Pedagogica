const { ZodError } = require("zod");
const { AppError } = require("../utils/AppError");

function notFoundHandler(req, res, next) {
  next(new AppError(404, "NOT_FOUND", `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, statusCode: err.statusCode },
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        statusCode: 422,
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor.", statusCode: 500 },
  });
}

module.exports = { notFoundHandler, errorHandler };
