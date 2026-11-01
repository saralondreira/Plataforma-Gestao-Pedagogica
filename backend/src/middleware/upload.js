const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { UPLOADS_DIR } = require("../config/paths");
const { AppError } = require("../utils/AppError");

const UPLOADS_ROOT = path.join(UPLOADS_DIR, "entregas");

function nomeSeguro(originalname) {
  return originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Sufixo aleatório: dois uploads no mesmo milissegundo nunca ficam com o mesmo nome em disco.
const sufixoUnico = () => crypto.randomBytes(6).toString("hex");

// Entregas (formador): só tipos de documento/imagem (ver EXTENSOES_PERMITIDAS, mais abaixo).
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Number() garante que só entram dígitos no caminho: um :id como "..%2f.." já não escapa da pasta.
    const dir = path.join(UPLOADS_ROOT, String(Number(req.params.id) || 0));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${sufixoUnico()}-${nomeSeguro(file.originalname)}`);
  },
});

// Uploads de formandos (justificações de faltas, trabalhos): só tipos de
// documento/imagem comuns — quem os submete tem menos confiança do que a
// coordenação, e os ficheiros são abertos por formadores e coordenação.
const EXTENSOES_PERMITIDAS = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".txt", ".zip"]);
const EXTENSOES_ENTREGAS = new Set([...EXTENSOES_PERMITIDAS, ".ppt", ".pptx", ".xls", ".xlsx"]);

function criarUploadRestrito(subpasta, resolverPasta, extensoes = EXTENSOES_PERMITIDAS) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        // Number() garante que só entram dígitos no caminho (sem path traversal).
        const dir = path.join(UPLOADS_DIR, subpasta, String(Number(resolverPasta(req)) || 0));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${req.user.id}-${sufixoUnico()}-${nomeSeguro(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const extensao = path.extname(file.originalname).toLowerCase();
      if (!extensoes.has(extensao)) {
        return cb(
          new AppError(422, "TIPO_FICHEIRO_INVALIDO", `Tipo de ficheiro não permitido (aceites: ${[...extensoes].map((e) => e.slice(1)).join(", ")}).`)
        );
      }
      cb(null, true);
    },
  });
}

// Mesmos tipos das outras áreas, acrescentando apresentações e folhas de cálculo.
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    if (!EXTENSOES_ENTREGAS.has(extensao)) {
      return cb(new AppError(422, "TIPO_FICHEIRO_INVALIDO", `Tipo de ficheiro não permitido (aceites: ${[...EXTENSOES_ENTREGAS].map((e) => e.slice(1)).join(", ")}).`));
    }
    cb(null, true);
  },
});

const uploadJustificacao = criarUploadRestrito("justificacoes", (req) => req.user.id);
const uploadSubmissaoTrabalho = criarUploadRestrito("trabalhos", (req) => req.params.id);

// Repositório de documentos da UC (formador/coordenação): inclui apresentações e folhas de cálculo.
const EXTENSOES_DOCUMENTOS = new Set([...EXTENSOES_PERMITIDAS, ".ppt", ".pptx", ".xls", ".xlsx"]);
const uploadDocumentoUc = criarUploadRestrito("documentos", (req) => req.params.turmaUcId, EXTENSOES_DOCUMENTOS);

module.exports = { upload, uploadJustificacao, uploadSubmissaoTrabalho, uploadDocumentoUc };
