const { prisma } = require("./prisma");
const { AppError } = require("../utils/AppError");

// Regras de acesso partilhadas pelos módulos de notas, assiduidade, trabalhos
// e mensagens: "quem é o formador responsável por esta UC nesta turma" e
// "este formando pertence a esta turma".

async function obterTurmaUcOuFalhar(id) {
  const turmaUc = await prisma.turmaUc.findUnique({
    where: { id },
    include: { uc: true, turma: true },
  });
  if (!turmaUc) {
    throw new AppError(404, "TURMA_UC_NOT_FOUND", "Associação Turma/UC não encontrada.");
  }
  return turmaUc;
}

function garantirResponsavelOuCoordenador(user, turmaUc) {
  if (user.role === "COORDENADOR") return;
  if (user.role === "FORMADOR" && turmaUc.formadorId === user.id) return;
  throw new AppError(403, "FORBIDDEN", "Só o formador responsável por esta UC (ou a coordenação) pode fazer isto.");
}

// Leitura de uma UC de uma turma (aulas, associações): a coordenação, o formador
// responsável, o mediador da turma e os formandos dessa turma.
async function garantirAcessoLeituraTurmaUc(user, turmaUc) {
  if (user.role === "COORDENADOR") return;
  if (user.role === "FORMADOR" && (turmaUc.formadorId === user.id || turmaUc.turma?.mediadorId === user.id)) return;
  if (user.role === "FORMANDO") {
    const formando = await prisma.user.findUnique({ where: { id: user.id }, select: { turmaId: true } });
    if (formando?.turmaId === turmaUc.turmaId) return;
  }
  throw new AppError(403, "FORBIDDEN", "Não tens acesso a esta UC.");
}

// Leitura das UCs de uma turma: a coordenação, quem leciona alguma UC da turma,
// o mediador e os formandos da própria turma.
async function garantirAcessoLeituraTurma(user, turmaId) {
  if (user.role === "COORDENADOR") return;
  if (user.role === "FORMADOR") {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { mediadorId: true } });
    if (turma?.mediadorId === user.id) return;
    if ((await prisma.turmaUc.count({ where: { turmaId, formadorId: user.id, ativo: true } })) > 0) return;
  }
  if (user.role === "FORMANDO") {
    const formando = await prisma.user.findUnique({ where: { id: user.id }, select: { turmaId: true } });
    if (formando?.turmaId === turmaId) return;
  }
  throw new AppError(403, "FORBIDDEN", "Não tens acesso a esta turma.");
}

async function formandosDaTurma(turmaId) {
  return prisma.user.findMany({
    where: { role: "FORMANDO", ativo: true, turmaId },
    select: { id: true, nome: true, email: true },
    orderBy: { nome: "asc" },
  });
}

async function garantirFormandoDaTurma(formandoId, turmaId) {
  const formando = await prisma.user.findUnique({ where: { id: formandoId } });
  if (!formando || formando.role !== "FORMANDO" || !formando.ativo || formando.turmaId !== turmaId) {
    throw new AppError(422, "FORMANDO_INVALIDO", "Este formando não existe, está inativo ou não pertence a esta turma.");
  }
  return formando;
}

// Para os endpoints "as minhas coisas" do formando: precisa de ter turma.
async function formandoComTurma(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.turmaId) {
    throw new AppError(409, "SEM_TURMA", "Ainda não estás associado a nenhuma turma — contacta a coordenação.");
  }
  return user;
}

module.exports = {
  obterTurmaUcOuFalhar,
  garantirResponsavelOuCoordenador,
  garantirAcessoLeituraTurmaUc,
  garantirAcessoLeituraTurma,
  formandosDaTurma,
  garantirFormandoDaTurma,
  formandoComTurma,
};
