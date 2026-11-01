const { prisma } = require("../lib/prisma");
const { AppError } = require("../utils/AppError");

const LIMITE = 8;

// Pesquisa global da coordenação: turmas, formadores, formandos e UCs do
// catálogo, só registos ativos. A comparação "contains" do MySQL ignora
// maiúsculas/acentos conforme a collation da BD (por omissão, utf8mb4_0900_ai_ci).
// Nunca devolve passwordHash nem campos desnecessários.
async function pesquisar(termo) {
  const q = String(termo || "").trim();
  if (q.length < 2) {
    throw new AppError(422, "PESQUISA_CURTA", "Escreve pelo menos 2 letras para pesquisar.");
  }
  const contem = (campo) => ({ [campo]: { contains: q } });

  const [turmas, formadores, formandos, ucs] = await Promise.all([
    prisma.turma.findMany({
      where: { ativo: true, OR: [contem("codigo"), contem("designacao"), contem("idCursoIEFP")] },
      select: { id: true, codigo: true, designacao: true, estado: true },
      orderBy: { codigo: "asc" },
      take: LIMITE,
    }),
    prisma.user.findMany({
      where: { role: "FORMADOR", ativo: true, OR: [contem("nome"), contem("sigla"), contem("email")] },
      select: { id: true, nome: true, sigla: true, email: true },
      orderBy: { nome: "asc" },
      take: LIMITE,
    }),
    prisma.user.findMany({
      where: { role: "FORMANDO", ativo: true, OR: [contem("nome"), contem("email")] },
      select: { id: true, nome: true, email: true, turma: { select: { id: true, codigo: true } } },
      orderBy: { nome: "asc" },
      take: LIMITE,
    }),
    prisma.uc.findMany({
      where: { ativo: true, OR: [contem("abreviatura"), contem("nome")] },
      select: { id: true, abreviatura: true, nome: true, cargaHoraria: true },
      orderBy: { abreviatura: "asc" },
      take: LIMITE,
    }),
  ]);

  return { termo: q, turmas, formadores, formandos, ucs };
}

module.exports = { pesquisar };
