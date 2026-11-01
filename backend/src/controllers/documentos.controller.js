const { z } = require("zod");
const documentosService = require("../services/documentos.service");
const { AppError } = require("../utils/AppError");

const enviarSchema = z.object({ categoria: z.enum(["MATERIAL", "PLANO", "AVALIACAO", "OUTRO"]).default("MATERIAL") });

const envolver = (fn) => async (req, res, next) => {
  try {
    const { status = 200, data } = await fn(req);
    res.status(status).json({ data });
  } catch (error) {
    next(error);
  }
};

// Não usa envolver(): se algo falhar depois do upload, o ficheiro em disco tem de ser apagado.
async function enviar(req, res, next) {
  try {
    const { categoria } = enviarSchema.parse(req.body);
    const data = await documentosService.enviar(req.user, Number(req.params.turmaUcId), req.file, categoria);
    res.status(201).json({ data });
  } catch (error) {
    documentosService.apagarFicheiroEnviado(req.file);
    next(error);
  }
}

async function ficheiro(req, res, next) {
  try {
    const { caminho, nome } = await documentosService.obterFicheiro(req.user, Number(req.params.id));
    res.download(caminho, nome, (erro) => {
      if (erro && !res.headersSent) {
        next(new AppError(404, "FICHEIRO_NOT_FOUND", "O ficheiro já não está disponível no servidor."));
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  enviar,
  ficheiro,
  listarDaTurmaUc: envolver(async (req) => ({
    data: await documentosService.listarDaTurmaUc(req.user, Number(req.params.turmaUcId), { historico: req.query.historico === "1" }),
  })),
  daTurmaDoFormando: envolver(async (req) => ({ data: await documentosService.daTurmaDoFormando(req.user) })),
  remover: envolver(async (req) => ({ data: await documentosService.remover(req.user, Number(req.params.id)) })),
};
