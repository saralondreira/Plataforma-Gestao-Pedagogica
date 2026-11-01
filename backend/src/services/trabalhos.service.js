const fs = require("fs");
const path = require("path");
const { hojeEmLisboa } = require("../lib/tempo");
const { prisma } = require("../lib/prisma");
const { notificar } = require("../lib/notificacoes");
const { AppError } = require("../utils/AppError");
const { UPLOADS_DIR } = require("../config/paths");
const {
  obterTurmaUcOuFalhar,
  garantirResponsavelOuCoordenador,
  formandosDaTurma,
  formandoComTurma,
} = require("../lib/acesso");


// A data limite é um dia (sem hora): o prazo só acaba no fim desse dia.
function prazoTerminou(dataLimite) {
  return hojeEmLisboa().getTime() > dataLimite.getTime();
}

function removerFicheiroSilencioso(ficheiro) {
  if (ficheiro?.path) fs.unlink(ficheiro.path, () => {});
}

async function obterTrabalhoOuFalhar(id) {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id },
    include: { turmaUc: { include: { uc: true, turma: true } } },
  });
  if (!trabalho) {
    throw new AppError(404, "TRABALHO_NOT_FOUND", "Trabalho não encontrado.");
  }
  return trabalho;
}

// --- Formador responsável / coordenação ---

async function criar(user, { turmaUcId, titulo, descricao, dataLimite }) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);
  if (!turmaUc.ativo) {
    throw new AppError(422, "TURMA_UC_INATIVA", "Esta UC está desativada nesta turma — não é possível atribuir trabalhos.");
  }
  const trabalho = await prisma.trabalho.create({
    data: { turmaUcId, titulo, descricao, dataLimite, criadoPorId: user.id },
  });

  const formandos = await formandosDaTurma(turmaUc.turmaId);
  await notificar(
    formandos.map((f) => f.id),
    {
      tipo: "TRABALHO_NOVO",
      assunto: `Novo trabalho em ${turmaUc.uc.abreviatura}: ${titulo}`,
      linhas: [
        `Foi atribuído um novo trabalho na UC ${turmaUc.uc.abreviatura} — ${turmaUc.uc.nome}: "${titulo}".`,
        `Prazo de entrega: ${dataLimite.toISOString().slice(0, 10)}.`,
      ],
    }
  );

  return trabalho;
}

async function listarDaTurmaUc(user, turmaUcId) {
  const turmaUc = await obterTurmaUcOuFalhar(turmaUcId);
  garantirResponsavelOuCoordenador(user, turmaUc);

  const [trabalhos, totalFormandos] = await Promise.all([
    prisma.trabalho.findMany({
      where: { turmaUcId, ativo: true },
      include: { _count: { select: { submissoes: true } } },
      orderBy: { dataLimite: "asc" },
    }),
    prisma.user.count({ where: { role: "FORMANDO", ativo: true, turmaId: turmaUc.turmaId } }),
  ]);

  return trabalhos.map(({ _count, ...trabalho }) => ({
    ...trabalho,
    totalSubmissoes: _count.submissoes,
    totalFormandos,
  }));
}

async function atualizar(user, id, dados) {
  const trabalho = await obterTrabalhoOuFalhar(id);
  garantirResponsavelOuCoordenador(user, trabalho.turmaUc);
  return prisma.trabalho.update({ where: { id }, data: dados });
}

// Soft delete, como no resto do projeto: o histórico de submissões mantém-se.
async function apagar(user, id) {
  const trabalho = await obterTrabalhoOuFalhar(id);
  garantirResponsavelOuCoordenador(user, trabalho.turmaUc);
  await prisma.trabalho.update({ where: { id }, data: { ativo: false } });
}

async function listarSubmissoes(user, trabalhoId) {
  const trabalho = await obterTrabalhoOuFalhar(trabalhoId);
  garantirResponsavelOuCoordenador(user, trabalho.turmaUc);

  const [formandos, submissoes] = await Promise.all([
    formandosDaTurma(trabalho.turmaUc.turmaId),
    prisma.submissaoTrabalho.findMany({ where: { trabalhoId } }),
  ]);
  const porFormando = new Map(submissoes.map((s) => [s.formandoId, s]));

  return {
    trabalho: {
      id: trabalho.id,
      titulo: trabalho.titulo,
      descricao: trabalho.descricao,
      dataLimite: trabalho.dataLimite,
      uc: { abreviatura: trabalho.turmaUc.uc.abreviatura },
    },
    formandos: formandos.map((formando) => {
      const s = porFormando.get(formando.id);
      return {
        formando,
        submissao: s
          ? {
              id: s.id,
              comentario: s.comentario,
              avaliacao: s.avaliacao,
              feedback: s.feedback,
              enviadaEm: s.enviadaEm,
            }
          : null,
      };
    }),
  };
}

async function avaliar(user, submissaoId, { avaliacao, feedback }) {
  const submissao = await prisma.submissaoTrabalho.findUnique({
    where: { id: submissaoId },
    include: { trabalho: { include: { turmaUc: true } } },
  });
  if (!submissao) {
    throw new AppError(404, "SUBMISSAO_NOT_FOUND", "Submissão não encontrada.");
  }
  garantirResponsavelOuCoordenador(user, submissao.trabalho.turmaUc);

  const avaliada = await prisma.submissaoTrabalho.update({
    where: { id: submissaoId },
    data: { avaliacao: avaliacao ?? null, feedback: feedback ?? null },
  });

  if (avaliacao != null || feedback) {
    await notificar([submissao.formandoId], {
      tipo: "TRABALHO_AVALIADO",
      assunto: `O teu trabalho "${submissao.trabalho.titulo}" foi avaliado`,
      linhas: [`O formador avaliou o teu trabalho "${submissao.trabalho.titulo}".`, "Consulta a avaliação na plataforma."],
    });
  }

  return avaliada;
}

// --- Formando ---

async function minhas(userId) {
  const formando = await formandoComTurma(userId);

  const trabalhos = await prisma.trabalho.findMany({
    where: { ativo: true, turmaUc: { turmaId: formando.turmaId, ativo: true } },
    include: {
      turmaUc: { select: { uc: { select: { abreviatura: true, nome: true } } } },
      submissoes: { where: { formandoId: userId } },
    },
    orderBy: { dataLimite: "asc" },
  });

  return trabalhos.map(({ submissoes, turmaUc, ...trabalho }) => {
    const s = submissoes[0];
    return {
      ...trabalho,
      uc: turmaUc.uc,
      prazoTerminado: prazoTerminou(trabalho.dataLimite),
      submissao: s
        ? { id: s.id, comentario: s.comentario, avaliacao: s.avaliacao, feedback: s.feedback, enviadaEm: s.enviadaEm }
        : null,
    };
  });
}

async function submeter(userId, trabalhoId, { comentario }, ficheiro) {
  try {
    const formando = await formandoComTurma(userId);
    const trabalho = await obterTrabalhoOuFalhar(trabalhoId);

    if (trabalho.turmaUc.turmaId !== formando.turmaId) {
      throw new AppError(403, "FORBIDDEN", "Este trabalho não é da tua turma.");
    }
    if (!trabalho.ativo || !trabalho.turmaUc.ativo) {
      throw new AppError(422, "TRABALHO_INATIVO", "Este trabalho foi removido.");
    }
    if (!ficheiro) {
      throw new AppError(422, "VALIDATION_ERROR", "Nenhum ficheiro enviado.");
    }
    if (prazoTerminou(trabalho.dataLimite)) {
      throw new AppError(409, "PRAZO_ULTRAPASSADO", "O prazo de entrega deste trabalho já terminou.");
    }

    const anterior = await prisma.submissaoTrabalho.findUnique({
      where: { trabalhoId_formandoId: { trabalhoId, formandoId: userId } },
    });

    const ficheiroUrl = `/uploads/trabalhos/${trabalhoId}/${ficheiro.filename}`;
    // Reenviar substitui a entrega e apaga a avaliação anterior (já não se aplica ao novo ficheiro).
    const dados = { ficheiroUrl, comentario: comentario ?? null, avaliacao: null, feedback: null, enviadaEm: new Date() };
    const submissao = await prisma.submissaoTrabalho.upsert({
      where: { trabalhoId_formandoId: { trabalhoId, formandoId: userId } },
      update: dados,
      create: { trabalhoId, formandoId: userId, ...dados },
    });

    if (anterior) {
      fs.unlink(path.join(UPLOADS_DIR, "trabalhos", String(trabalhoId), path.basename(anterior.ficheiroUrl)), () => {});
    }
    return submissao;
  } catch (erro) {
    removerFicheiroSilencioso(ficheiro); // não deixar ficheiros órfãos se a submissão falhou
    throw erro;
  }
}

// Quem pode abrir o ficheiro: o próprio formando, o formador responsável, a coordenação.
async function obterFicheiroSubmissao(user, submissaoId) {
  const submissao = await prisma.submissaoTrabalho.findUnique({
    where: { id: submissaoId },
    include: { trabalho: { include: { turmaUc: true } } },
  });
  if (!submissao) {
    throw new AppError(404, "SUBMISSAO_NOT_FOUND", "Submissão não encontrada.");
  }

  const eODono = user.role === "FORMANDO" && submissao.formandoId === user.id;
  const eResponsavel = user.role === "FORMADOR" && submissao.trabalho.turmaUc.formadorId === user.id;
  if (!eODono && !eResponsavel && user.role !== "COORDENADOR") {
    throw new AppError(403, "FORBIDDEN", "Não tens permissão para ver este ficheiro.");
  }
  return { trabalhoId: submissao.trabalhoId, ficheiroUrl: submissao.ficheiroUrl };
}

module.exports = {
  criar,
  listarDaTurmaUc,
  atualizar,
  apagar,
  listarSubmissoes,
  avaliar,
  minhas,
  submeter,
  obterFicheiroSubmissao,
};
