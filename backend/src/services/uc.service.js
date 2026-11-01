const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

// Catálogo de UCs — independente de turma. A associação de uma UC a uma
// turma concreta (com formador atribuído) vive em turmaUc.service.js.

async function listar({ incluirInativos = false } = {}) {
  return prisma.uc.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { abreviatura: "asc" },
  });
}

async function obterOuFalhar(id) {
  const uc = await prisma.uc.findUnique({ where: { id } });
  if (!uc) {
    throw new AppError(404, "UC_NOT_FOUND", "UC não encontrada.");
  }
  return uc;
}

// A carga horária é partilhada por todas as turmas que usam esta UC —
// não pode descer abaixo do que já foi dado em nenhuma delas, senão
// viola-se a mesma regra que aula.service.js força ao agendar.
async function garantirCargaHorariaSuficiente(ucId, cargaHoraria) {
  const associacoes = await prisma.turmaUc.findMany({ where: { ucId }, select: { id: true } });
  const horasPorAssociacao = await Promise.all(
    associacoes.map((a) => prisma.aula.aggregate({ where: { turmaUcId: a.id }, _sum: { duracaoHoras: true } }))
  );
  const maxHorasDadas = horasPorAssociacao.reduce((max, r) => Math.max(max, r._sum.duracaoHoras || 0), 0);
  if (cargaHoraria < maxHorasDadas) {
    throw new AppError(
      422,
      "CARGA_HORARIA_INSUFICIENTE",
      `Já há ${maxHorasDadas}h agendadas numa turma com esta UC — não é possível reduzir a carga horária abaixo disso.`
    );
  }
}

async function criar(dados) {
  const existente = await prisma.uc.findUnique({ where: { abreviatura: dados.abreviatura } });
  if (existente && existente.ativo) {
    throw new AppError(409, "ABREVIATURA_EM_USO", "Já existe uma UC no catálogo com esta abreviatura.");
  }

  // Já existiu uma UC inativa com esta abreviatura — reativa-a em vez de criar
  // uma linha nova (a abreviatura é única na base de dados), preservando as
  // associações a turmas que já existiam para esse id.
  if (existente) {
    await garantirCargaHorariaSuficiente(existente.id, dados.cargaHoraria);
    return prisma.uc.update({ where: { id: existente.id }, data: { ...dados, ativo: true } });
  }

  return prisma.uc.create({ data: dados });
}

async function atualizar(id, dados) {
  await obterOuFalhar(id);
  if (dados.abreviatura) {
    const existente = await prisma.uc.findUnique({ where: { abreviatura: dados.abreviatura } });
    if (existente && existente.id !== id) {
      throw new AppError(409, "ABREVIATURA_EM_USO", "Já existe uma UC no catálogo com esta abreviatura.");
    }
  }
  if (dados.cargaHoraria !== undefined) await garantirCargaHorariaSuficiente(id, dados.cargaHoraria);
  return prisma.uc.update({ where: { id }, data: dados });
}

// Antes recusava apagar (409 UC_ASSOCIADA_A_TURMAS) se a UC já estivesse
// associada a alguma turma — era a única forma de evitar perder essa
// associação, já que o DELETE definitivo ia falhar de qualquer forma (chave
// estrangeira). Agora a UC fica apenas inativa: deixa de aparecer para novas
// associações, mas as associações e aulas já existentes mantêm-se intactas.
async function apagar(id) {
  await obterOuFalhar(id);
  await prisma.uc.update({ where: { id }, data: { ativo: false } });
}

async function reativar(id) {
  await obterOuFalhar(id);
  return prisma.uc.update({ where: { id }, data: { ativo: true } });
}

module.exports = { listar, criar, atualizar, apagar, reativar, obterOuFalhar };
