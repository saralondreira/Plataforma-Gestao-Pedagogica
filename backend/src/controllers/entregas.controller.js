const { z } = require("zod");
const entregasService = require("../services/entregas.service");
const { AppError } = require("../utils/AppError");

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

async function listar(req, res, next) {
  try {
    res.json({ data: await entregasService.listar() });
  } catch (error) {
    next(error);
  }
}

async function listarMinhas(req, res, next) {
  try {
    res.json({ data: await entregasService.listarPorFormador(req.user.id) });
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
    next(error);
  }
}

async function excecao(req, res, next) {
  try {
    const id = Number(req.params.id);
    const entregaAtual = await entregasService.obterOuFalhar(id);
    garantirDonoOuCoordenador(req, entregaAtual);

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

module.exports = { listar, listarMinhas, criar, atualizar, apagar, marcarComoEntregue, submeter, excecao };
