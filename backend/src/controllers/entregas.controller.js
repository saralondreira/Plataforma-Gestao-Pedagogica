const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const entregasService = require("../services/entregas.service");
const { AppError } = require("../utils/AppError");
const { UPLOADS_DIR } = require("../config/paths");

const criarSchema = z.object({
  formadorId: z.coerce.number().int(),
  turmaId: z.coerce.number().int(),
  documento: z.string().min(2),
  dataLimite: z.coerce.date(),
});

const atualizarSchema = criarSchema.partial();

const excecaoSchema = z.object({
  nota: z.string().min(3),
});

function garantirDonoOuCoordenador(req, entrega) {
  if (req.user.role === "COORDENADOR") return;
  if (entrega.formadorId !== req.user.id) {
    throw new AppError(403, "FORBIDDEN", "Só podes submeter os teus próprios documentos.");
  }
}

// obterOuFalhar() não filtra por ativo (reativar() também precisa de a
// encontrar inativa) — sem esta verificação dava para submeter um ficheiro
// ou uma exceção numa entrega já desativada, usando o id diretamente.
function garantirAtiva(entrega) {
  if (!entrega.ativo) {
    throw new AppError(422, "ENTREGA_INATIVA", "Esta entrega foi desativada — contacta a coordenação.");
  }
}

async function listar(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    res.json({ data: await entregasService.listar({ incluirInativos }) });
  } catch (error) {
    next(error);
  }
}

async function listarMinhas(req, res, next) {
  try {
    const incluirInativos = req.query.incluirInativos === "true";
    res.json({ data: await entregasService.listarPorFormador(req.user.id, { incluirInativos }) });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const dados = criarSchema.parse(req.body);
    const entrega = await entregasService.criar(dados);
    res.status(201).json({ data: entrega });
  } catch (error) {
    next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const dados = atualizarSchema.parse(req.body);
    const entrega = await entregasService.atualizar(id, dados);
    res.json({ data: entrega });
  } catch (error) {
    next(error);
  }
}

async function apagar(req, res, next) {
  try {
    const id = Number(req.params.id);
    await entregasService.apagar(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

async function reativar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entrega = await entregasService.reativar(id);
    res.json({ data: entrega });
  } catch (error) {
    next(error);
  }
}

async function marcarComoEntregue(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entrega = await entregasService.marcarComoEntregue(id, {
      submissaoTipo: "COORDENACAO",
      submissaoData: new Date(),
    });
    res.json({ data: entrega });
  } catch (error) {
    next(error);
  }
}

async function submeter(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entregaAtual = await entregasService.obterOuFalhar(id);
    garantirDonoOuCoordenador(req, entregaAtual);
    garantirAtiva(entregaAtual);

    if (!req.file) {
      throw new AppError(422, "VALIDATION_ERROR", "Nenhum ficheiro enviado.");
    }

    const ficheiroUrl = `/uploads/entregas/${id}/${req.file.filename}`;
    const entrega = await entregasService.marcarComoEntregue(id, {
      submissaoTipo: "FICHEIRO",
      submissaoFicheiroUrl: ficheiroUrl,
      submissaoData: new Date(),
    });
    res.json({ data: entrega });
  } catch (error) {
    // O multer já gravou o ficheiro antes das verificações: se o pedido é recusado, não fica lixo em disco.
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(error);
  }
}

async function excecao(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entregaAtual = await entregasService.obterOuFalhar(id);
    garantirDonoOuCoordenador(req, entregaAtual);
    garantirAtiva(entregaAtual);

    const { nota } = excecaoSchema.parse(req.body);
    const entrega = await entregasService.marcarComoEntregue(id, {
      submissaoTipo: "EXCECAO",
      submissaoNota: nota,
      submissaoData: new Date(),
    });
    res.json({ data: entrega });
  } catch (error) {
    next(error);
  }
}


// Os ficheiros submetidos deixaram de ser servidos como estáticos públicos
// (/uploads): só o formador dono da entrega, ou a coordenação, os descarrega
// — por aqui, com o token. O caminho vem sempre da BD (nunca do pedido) e só
// se usa o nome do ficheiro, para não haver path traversal.
async function ficheiro(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entrega = await entregasService.obterOuFalhar(id);
    garantirDonoOuCoordenador(req, entrega);

    if (entrega.submissaoTipo !== "FICHEIRO" || !entrega.submissaoFicheiroUrl) {
      throw new AppError(404, "FICHEIRO_NOT_FOUND", "Esta entrega não tem nenhum ficheiro submetido.");
    }

    const caminho = path.join(UPLOADS_DIR, "entregas", String(id), path.basename(entrega.submissaoFicheiroUrl));
    res.sendFile(caminho, (erro) => {
      if (erro && !res.headersSent) {
        next(new AppError(404, "FICHEIRO_NOT_FOUND", "O ficheiro já não está disponível no servidor."));
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { ficheiro, listar, listarMinhas, criar, atualizar, apagar, reativar, marcarComoEntregue, submeter, excecao };
