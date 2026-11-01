const { prisma } = require("../lib/prisma");
const turmaUcService = require("./turmaUc.service");
const assiduidadeService = require("./assiduidade.service");

// Vista do mediador: um formador que é o "mediador responsável" de uma ou mais
// turmas vê, só dessas turmas, o essencial para as acompanhar — UCs com horas
// dadas/em falta e formador, e a assiduidade de cada formando. Só leitura: a
// gestão (agendar, trocar formadores) continua a ser da coordenação.
async function minhasTurmas(userId) {
  const turmas = await prisma.turma.findMany({
    where: { mediadorId: userId, ativo: true },
    select: { id: true, codigo: true, designacao: true, estado: true, dataInicio: true, idCursoIEFP: true },
    orderBy: { codigo: "asc" },
  });

  return Promise.all(
    turmas.map(async (turma) => {
      const [ucs, assiduidade] = await Promise.all([
        turmaUcService.listarPorTurma(turma.id),
        assiduidadeService.resumoDaTurma(turma.id),
      ]);
      return {
        turma,
        ucs: ucs.map((u) => ({
          id: u.id,
          abreviatura: u.uc.abreviatura,
          nome: u.uc.nome,
          formador: u.formador.nome,
          cargaHoraria: u.uc.cargaHoraria,
          horasDadas: u.horasDadas,
          horasEmFalta: u.horasEmFalta,
        })),
        aulasDadas: assiduidade.aulasDadas,
        formandos: assiduidade.formandos.map((f) => ({
          id: f.formando.id,
          nome: f.formando.nome,
          presencas: f.presencas,
          faltas: f.faltas,
          faltasInjustificadas: f.faltasInjustificadas,
        })),
      };
    })
  );
}

module.exports = { minhasTurmas };
