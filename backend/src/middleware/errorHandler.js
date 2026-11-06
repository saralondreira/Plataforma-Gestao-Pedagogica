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

  if (err.name === "MulterError") {
    const mensagem = err.code === "LIMIT_FILE_SIZE" ? "O ficheiro é demasiado grande (máximo 10 MB)." : "Erro ao carregar o ficheiro.";
    return res.status(422).json({ error: { code: "UPLOAD_INVALIDO", message: mensagem, statusCode: 422 } });
  }

  // Corpo JSON inválido ou demasiado grande (erros do express.json): problema do pedido, não do servidor.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "JSON_INVALIDO", message: "O corpo do pedido não é JSON válido.", statusCode: 400 } });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "CORPO_DEMASIADO_GRANDE", message: "O corpo do pedido é demasiado grande.", statusCode: 413 } });
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

  // Rede de segurança: a base de dados recusou apagar ou alterar um registo ligado a outros
  // (chave estrangeira). É um conflito do pedido, não uma falha do servidor.
  if (err.code === "P2003" || err.code === "P2014") {
    return res.status(409).json({
      error: { code: "REGISTO_EM_USO", message: "Não é possível apagar este registo porque tem dados associados.", statusCode: 409 },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor.", statusCode: 500 },
  });
}

module.exports = { notFoundHandler, errorHandler };
