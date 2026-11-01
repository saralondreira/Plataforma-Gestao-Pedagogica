const { prisma } = require("../lib/prisma");
const { hojeEmLisboa } = require("../lib/tempo");
const { AppError } = require("../utils/AppError");
const conformidadeService = require("./conformidade.service");

// Painéis de resumo dos dashboards (formador, formando, coordenação). Só leitura:
// agrega dados que as outras funcionalidades já guardam — sem tabelas novas.

// A partir de quantas faltas INJUSTIFICADAS um formando aparece como "em risco"
// no painel da coordenação.
const FALTAS_INJUSTIFICADAS_ALERTA = 3;

function inicioDeHoje() {
  return hojeEmLisboa();
}

function contagemPor(linhas, chave) {
  return new Map(linhas.map((l) => [l[chave], l._count?._all ?? l._count]));
}

// --- Formador: estado de cada UC que leciona + o que tem por tratar ---

async function resumoDoFormador(formadorId) {
  const turmaUcs = await prisma.turmaUc.findMany({
    where: { formadorId, ativo: true, turma: { ativo: true } },
    include: { uc: true, turma: true },
    orderBy: [{ turma: { codigo: "asc" } }, { uc: { abreviatura: "asc" } }],
  });
  const ids = turmaUcs.map((t) => t.id);
  const turmaIds = [...new Set(turmaUcs.map((t) => t.turmaId))];

  const [horas, formandos, notas, trabalhos, justificacoesPendentes, submissoesPorAvaliar, proximasAulas] = await Promise.all([
    prisma.aula.groupBy({ by: ["turmaUcId"], where: { turmaUcId: { in: ids } }, _sum: { duracaoHoras: true } }),
    prisma.user.groupBy({ by: ["turmaId"], where: { role: "FORMANDO", ativo: true, turmaId: { in: turmaIds } }, _count: { _all: true } }),
    prisma.nota.groupBy({ by: ["turmaUcId"], where: { turmaUcId: { in: ids }, formando: { ativo: true } }, _count: { _all: true } }),
    prisma.trabalho.groupBy({ by: ["turmaUcId"], where: { turmaUcId: { in: ids }, ativo: true }, _count: { _all: true } }),
    prisma.justificacao.count({ where: { estado: "PENDENTE", aula: { turmaUcId: { in: ids } } } }),
    prisma.submissaoTrabalho.count({
      where: { avaliacao: null, feedback: null, trabalho: { ativo: true, turmaUcId: { in: ids } } },
    }),
    prisma.aula.findMany({
      where: { turmaUcId: { in: ids }, data: { gte: inicioDeHoje() } },
      include: { turmaUc: { include: { uc: true, turma: true } } },
      orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
      take: 5,
    }),
  ]);

  const horasPorTuc = new Map(horas.map((h) => [h.turmaUcId, h._sum.duracaoHoras || 0]));
  const formandosPorTurma = contagemPor(formandos, "turmaId");
  const notasPorTuc = contagemPor(notas, "turmaUcId");
  const trabalhosPorTuc = contagemPor(trabalhos, "turmaUcId");

  return {
    justificacoesPendentes,
    submissoesPorAvaliar,
    ucs: turmaUcs.map((t) => {
      const horasDadas = horasPorTuc.get(t.id) || 0;
      return {
        turmaUcId: t.id,
        turma: t.turma.codigo,
        uc: { abreviatura: t.uc.abreviatura, nome: t.uc.nome },
        cargaHoraria: t.uc.cargaHoraria,
        horasDadas,
        horasEmFalta: Math.max(t.uc.cargaHoraria - horasDadas, 0),
        formandos: formandosPorTurma.get(t.turmaId) || 0,
        notasLancadas: notasPorTuc.get(t.id) || 0,
        trabalhosAtivos: trabalhosPorTuc.get(t.id) || 0,
      };
    }),
    proximasAulas: proximasAulas.map((a) => ({
      id: a.id,
      data: a.data,
      horaInicio: a.horaInicio,
      modalidade: a.modalidade,
      turma: a.turmaUc.turma.codigo,
      uc: a.turmaUc.uc.abreviatura,
    })),
  };
}

// --- Formando: o seu aproveitamento ---

async function resumoDoFormando(formandoId) {
  const formando = await prisma.user.findUnique({ where: { id: formandoId } });
  if (!formando?.turmaId) return { semTurma: true };

  const [notas, ausencias, aceites, justificacoesPendentes, trabalhos] = await Promise.all([
    prisma.nota.findMany({ where: { formandoId, turmaUc: { ativo: true } }, select: { valor: true } }),
    prisma.presenca.findMany({
      where: { formandoId, estado: "AUSENTE", aula: { turmaUc: { ativo: true } } },
      select: { aulaId: true },
    }),
    prisma.justificacao.findMany({ where: { formandoId, estado: "ACEITE" }, select: { aulaId: true } }),
    prisma.justificacao.count({ where: { formandoId, estado: "PENDENTE" } }),
    prisma.trabalho.findMany({
      where: { ativo: true, turmaUc: { turmaId: formando.turmaId, ativo: true } },
      select: { dataLimite: true, submissoes: { where: { formandoId }, select: { id: true } } },
    }),
  ]);

  const justificadas = new Set(aceites.map((j) => j.aulaId));
  const faltasInjustificadas = ausencias.filter((a) => !justificadas.has(a.aulaId)).length;

  const hoje = hojeEmLisboa().getTime(); // o prazo só acaba no fim do dia limite (em Lisboa)
  const porEntregar = trabalhos.filter((t) => t.submissoes.length === 0 && hoje <= t.dataLimite.getTime());
  const emAtraso = trabalhos.filter((t) => t.submissoes.length === 0 && hoje > t.dataLimite.getTime());
  const proximoPrazo = porEntregar.map((t) => t.dataLimite).sort((a, b) => a - b)[0] || null;

  return {
    semTurma: false,
    notasLancadas: notas.length,
    media: notas.length ? Math.round((notas.reduce((soma, n) => soma + n.valor, 0) / notas.length) * 10) / 10 : null,
    faltas: ausencias.length,
    faltasInjustificadas,
    justificacoesPendentes,
    trabalhosPorEntregar: porEntregar.length,
    trabalhosEmAtraso: emAtraso.length,
    proximoPrazo,
  };
}

// --- Coordenação: o que precisa de atenção ---

// Pendências de gestão: coisas que a coordenação deve resolver para a
// formação correr bem (só turmas ativas e ainda não concluídas).
//  - turmas sem mediador responsável;
//  - UCs cujo formador está inativo (ninguém pode dar as aulas);
//  - UCs com horas por agendar mas sem nenhuma aula futura marcada.
async function pendenciasDeGestao() {
  const hoje = hojeEmLisboa();

  const [turmasSemMediador, associacoes] = await Promise.all([
    prisma.turma.findMany({
      where: { ativo: true, estado: { not: "CONCLUIDA" }, mediadorId: null },
      select: { id: true, codigo: true, designacao: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.turmaUc.findMany({
      where: { ativo: true, turma: { ativo: true, estado: { not: "CONCLUIDA" } } },
      select: {
        id: true,
        turmaId: true,
        turma: { select: { codigo: true } },
        uc: { select: { abreviatura: true, cargaHoraria: true } },
        formador: { select: { nome: true, ativo: true } },
        aulas: { select: { data: true, duracaoHoras: true } },
      },
      orderBy: [{ turmaId: "asc" }, { id: "asc" }],
    }),
  ]);

  const item = (a, motivo) => ({ turmaUcId: a.id, turmaId: a.turmaId, turma: a.turma.codigo, uc: a.uc.abreviatura, formador: a.formador.nome, motivo });
  const ucsComFormadorInativo = associacoes.filter((a) => !a.formador.ativo).map((a) => item(a, "Formador inativo"));
  const ucsSemAulasFuturas = associacoes
    .filter((a) => {
      const agendadas = a.aulas.reduce((total, aula) => total + aula.duracaoHoras, 0);
      return agendadas < a.uc.cargaHoraria && !a.aulas.some((aula) => aula.data >= hoje);
    })
    .map((a) => {
      const agendadas = a.aulas.reduce((total, aula) => total + aula.duracaoHoras, 0);
      return item(a, `${a.uc.cargaHoraria - agendadas}h por agendar, sem aulas futuras`);
    });

  return {
    turmasSemMediador: turmasSemMediador.slice(0, 10),
    totalTurmasSemMediador: turmasSemMediador.length,
    ucsComFormadorInativo: ucsComFormadorInativo.slice(0, 10),
    totalUcsComFormadorInativo: ucsComFormadorInativo.length,
    ucsSemAulasFuturas: ucsSemAulasFuturas.slice(0, 10),
    totalUcsSemAulasFuturas: ucsSemAulasFuturas.length,
  };
}

// Aulas de hoje e dos próximos 7 dias, de todas as turmas (visão de "o dia a dia").
async function proximasAulasDaCoordenacao() {
  const hoje = hojeEmLisboa();
  const limite = new Date(hoje);
  limite.setUTCDate(limite.getUTCDate() + 7);

  const aulas = await prisma.aula.findMany({
    where: { data: { gte: hoje, lte: limite }, turmaUc: { ativo: true } },
    select: {
      data: true,
      horaInicio: true,
      modalidade: true,
      turmaUc: { select: { uc: { select: { abreviatura: true } }, formador: { select: { nome: true } }, turma: { select: { codigo: true } } } },
    },
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
  });

  const dataISO = (a) => a.data.toISOString().slice(0, 10);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const item = (a) => ({ data: dataISO(a), hora: a.horaInicio, modalidade: a.modalidade, uc: a.turmaUc.uc.abreviatura, turma: a.turmaUc.turma.codigo, formador: a.turmaUc.formador.nome });
  return {
    hoje: aulas.filter((a) => dataISO(a) === hojeISO).map(item),
    proximosDias: aulas.filter((a) => dataISO(a) !== hojeISO).slice(0, 10).map(item),
    totalProximosDias: aulas.filter((a) => dataISO(a) !== hojeISO).length,
  };
}

// Só as contagens e as UCs não conformes (o detalhe completo está em /painel/conformidade).
async function resumoConformidade() {
  const { total, verde, amarelo, vermelho, ucs } = await conformidadeService.calcular({ role: "COORDENADOR" });
  return { total, verde, amarelo, vermelho, piores: ucs.filter((u) => u.estado === "VERMELHO").slice(0, 5) };
}

async function resumoDaCoordenacao() {
  const [justificacoesPendentes, mensagensPorLer, pedidosAcessoPorTratar, ausencias, aceites] = await Promise.all([
    prisma.justificacao.count({ where: { estado: "PENDENTE" } }),
    prisma.mensagem.count({ where: { lida: false, destino: { in: ["COORDENACAO", "ASSISTENTE_SOCIAL"] } } }),
    prisma.pedidoAcesso.count({ where: { estado: { in: ["PENDENTE", "A_AGUARDAR_RH"] } } }),
    prisma.presenca.findMany({
      where: { estado: "AUSENTE", formando: { ativo: true, role: "FORMANDO" }, aula: { turmaUc: { ativo: true } } },
      select: { aulaId: true, formandoId: true, formando: { select: { nome: true, turma: { select: { codigo: true } } } } },
    }),
    prisma.justificacao.findMany({ where: { estado: "ACEITE" }, select: { aulaId: true, formandoId: true } }),
  ]);

  const justificadas = new Set(aceites.map((j) => `${j.aulaId}:${j.formandoId}`));
  const porFormando = new Map();
  for (const a of ausencias) {
    if (justificadas.has(`${a.aulaId}:${a.formandoId}`)) continue;
    const atual = porFormando.get(a.formandoId) || { formandoId: a.formandoId, nome: a.formando.nome, turma: a.formando.turma?.codigo || null, faltasInjustificadas: 0 };
    atual.faltasInjustificadas += 1;
    porFormando.set(a.formandoId, atual);
  }

  const formandosEmRisco = [...porFormando.values()]
    .filter((f) => f.faltasInjustificadas >= FALTAS_INJUSTIFICADAS_ALERTA)
    .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas)
    .slice(0, 10);

  return {
    justificacoesPendentes,
    mensagensPorLer,
    pedidosAcessoPorTratar,
    limiteFaltas: FALTAS_INJUSTIFICADAS_ALERTA,
    formandosEmRisco,
    gestao: await pendenciasDeGestao(),
    conformidade: await resumoConformidade(),
    aulas: await proximasAulasDaCoordenacao(),
  };
}

async function resumo(user) {
  if (user.role === "FORMADOR") return { role: "FORMADOR", ...(await resumoDoFormador(user.id)) };
  if (user.role === "FORMANDO") return { role: "FORMANDO", ...(await resumoDoFormando(user.id)) };
  if (user.role === "COORDENADOR") return { role: "COORDENADOR", ...(await resumoDaCoordenacao()) };
  throw new AppError(403, "FORBIDDEN", "Sem permissão para ver este painel.");
}

module.exports = { resumo, FALTAS_INJUSTIFICADAS_ALERTA };
