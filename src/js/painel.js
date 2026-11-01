// Painel de resumo dos dashboards (formador, formando, coordenação). Insere-se
// por baixo do cabeçalho da página e mostra o que precisa de atenção, com
// ligações para as páginas onde se trata de cada coisa. É um extra: se o pedido
// falhar, o dashboard continua a funcionar sem ele.
import { api, getUser } from "./api-client.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataPT, formatarHora, formatarNota } from "./formatos.js";

const CORES = { atencao: "#f59e0b", alerta: "#ef4444", normal: "#3b82f6" };

function cartao(valor, rotulo, href, nivel = "normal", extra = "") {
  return `
    <a href="${href}" class="section-card" style="text-decoration: none; color: inherit; text-align: center; height: auto; border-top: 3px solid ${CORES[nivel]}">
      <h2 style="margin: 0">${valor}</h2>
      <p style="color: #64748b; margin: 4px 0 0">${rotulo}</p>
      ${extra ? `<small style="color: #94a3b8">${extra}</small>` : ""}
    </a>`;
}

function grelha(cartoes) {
  return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 15px; margin-bottom: 20px">${cartoes.join("")}</div>`;
}

function nivel(n, nivelSeHouver = "atencao") {
  return n > 0 ? nivelSeHouver : "normal";
}

function cartaoTabela(titulo, cabecalhos, linhas, vazio) {
  const corpo = linhas.length
    ? linhas.join("")
    : `<tr class="linha-vazia"><td colspan="${cabecalhos.length}" style="text-align: center; padding: 20px; color: #64748b">${vazio}</td></tr>`;
  return `
    <div class="section-card table-standard" style="height: auto; margin-bottom: 20px">
      <div class="card-header-simple"><h3>${titulo}</h3></div>
      <div class="table-container-clean" style="height: auto; max-height: 320px">
        <table class="status-table">
          <thead><tr>${cabecalhos.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
          <tbody>${corpo}</tbody>
        </table>
      </div>
    </div>`;
}

function barra(feito, total) {
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0;
  return `<div style="min-width: 90px"><div>${feito}/${total}h</div><div style="background: #e2e8f0; border-radius: 4px; height: 6px"><div style="width: ${pct}%; background: #3b82f6; height: 6px; border-radius: 4px"></div></div></div>`;
}

function htmlFormador(r) {
  const ucs = r.ucs.map(
    (u) => `
    <tr>
      <td>${escapeHtml(u.turma)}</td>
      <td><strong>${escapeHtml(u.uc.abreviatura)}</strong> — ${escapeHtml(u.uc.nome)}</td>
      <td>${barra(u.horasDadas, u.cargaHoraria)}</td>
      <td>${u.formandos}</td>
      <td>${u.notasLancadas}/${u.formandos}</td>
      <td>${u.trabalhosAtivos}</td>
    </tr>`
  );
  const aulas = r.proximasAulas.map(
    (a) => `<tr><td>${formatarDataPT(a.data)}</td><td>${formatarHora(a.horaInicio)}</td><td>${escapeHtml(a.turma)}</td><td>${escapeHtml(a.uc)}</td><td>${a.modalidade === "ONLINE" ? "Online" : "Presencial"}</td></tr>`
  );
  return (
    grelha([
      cartao(r.justificacoesPendentes, "Justificações por decidir", "assiduidade.html", nivel(r.justificacoesPendentes)),
      cartao(r.submissoesPorAvaliar, "Trabalhos por avaliar", "trabalhos.html", nivel(r.submissoesPorAvaliar)),
    ]) +
    cartaoTabela("As minhas UCs", ["Turma", "UC", "Horas agendadas", "Formandos", "Notas lançadas", "Trabalhos"], ucs, "Ainda não tens UCs atribuídas.") +
    cartaoTabela("Próximas aulas", ["Data", "Hora", "Turma", "UC", "Modalidade"], aulas, "Sem aulas futuras agendadas.")
  );
}

function htmlFormando(r) {
  if (r.semTurma) return "";
  const prazo = r.proximoPrazo ? `próximo prazo: ${formatarDataPT(r.proximoPrazo)}` : "";
  const atraso = r.trabalhosEmAtraso > 0 ? `${r.trabalhosEmAtraso} em atraso` : "";
  return grelha([
    cartao(r.media === null ? "—" : formatarNota(r.media), "Média das notas", "notas.html", "normal", `${r.notasLancadas} nota(s) lançada(s)`),
    cartao(r.faltasInjustificadas, "Faltas injustificadas", "assiduidade.html", nivel(r.faltasInjustificadas, "alerta"), `${r.faltas} falta(s) no total`),
    cartao(r.justificacoesPendentes, "Justificações pendentes", "assiduidade.html", nivel(r.justificacoesPendentes)),
    cartao(r.trabalhosPorEntregar, "Trabalhos por entregar", "trabalhos.html", r.trabalhosEmAtraso > 0 ? "alerta" : nivel(r.trabalhosPorEntregar), [prazo, atraso].filter(Boolean).join(" · ")),
  ]);
}

function htmlCoordenacao(r) {
  const risco = r.formandosEmRisco.map(
    (f) => `<tr><td><strong>${escapeHtml(f.nome)}</strong></td><td>${escapeHtml(f.turma || "—")}</td><td><span class="badge red">${f.faltasInjustificadas}</span></td></tr>`
  );
  return (
    grelha([
      cartao(r.pedidosAcessoPorTratar, "Pedidos de acesso por tratar", "pedidosAcesso.html", nivel(r.pedidosAcessoPorTratar)),
      cartao(r.justificacoesPendentes, "Justificações pendentes", "assiduidade.html", nivel(r.justificacoesPendentes)),
      cartao(r.mensagensPorLer, "Mensagens por ler", "mensagens.html", nivel(r.mensagensPorLer)),
      cartao(r.formandosEmRisco.length, "Formandos em risco", "pautas.html", nivel(r.formandosEmRisco.length, "alerta"), `${r.limiteFaltas}+ faltas injustificadas`),
    ]) + htmlConformidade(r.conformidade) + (risco.length ? cartaoTabela("Formandos com muitas faltas injustificadas", ["Formando", "Turma", "Faltas injustificadas"], risco, "") : "") + htmlPendenciasGestao(r.gestao) + htmlAulas(r.aulas)
  );
}

function htmlConformidade(c) {
  if (!c || c.total === 0) return "";
  const piores = c.piores.map(
    (u) => `<tr><td>${escapeHtml(u.turma)}</td><td><strong>${escapeHtml(u.uc)}</strong></td><td>${escapeHtml(u.formador)}</td><td><a href="conformidade.html">Ver detalhe</a></td></tr>`
  );
  return (
    grelha([
      cartao(c.vermelho, "UCs em falha", "conformidade.html", nivel(c.vermelho, "alerta"), "sumários ou documentos em falta"),
      cartao(c.amarelo, "UCs com atenção", "conformidade.html", nivel(c.amarelo)),
      cartao(c.verde, "UCs em dia", "conformidade.html"),
    ]) + (piores.length ? cartaoTabela("UCs em falha de conformidade", ["Turma", "UC", "Formador", ""], piores, "") : "")
  );
}

function htmlAulas(a) {
  if (!a) return "";
  const hora = (h) => `${String(h).padStart(2, "0")}:00`;
  const linhasHoje = a.hoje.map(
    (x) => `<tr><td>${hora(x.hora)}</td><td><strong>${escapeHtml(x.uc)}</strong></td><td>${escapeHtml(x.turma)}</td><td>${escapeHtml(x.formador)}</td><td>${x.modalidade === "ONLINE" ? "Online" : "Presencial"}</td></tr>`
  );
  const linhasProximas = a.proximosDias.map(
    (x) => `<tr><td>${formatarDataPT(x.data)} ${hora(x.hora)}</td><td><strong>${escapeHtml(x.uc)}</strong></td><td>${escapeHtml(x.turma)}</td><td>${escapeHtml(x.formador)}</td><td>${x.modalidade === "ONLINE" ? "Online" : "Presencial"}</td></tr>`
  );
  return (
    cartaoTabela("Aulas de hoje", ["Hora", "UC", "Turma", "Formador", "Modalidade"], linhasHoje, "Hoje não há aulas marcadas.") +
    cartaoTabela(`Próximos 7 dias (${a.totalProximosDias})`, ["Quando", "UC", "Turma", "Formador", "Modalidade"], linhasProximas, "Sem aulas nos próximos dias.")
  );
}

function htmlPendenciasGestao(g) {
  if (!g) return "";
  const linhas = [
    ...g.turmasSemMediador.map((t) => `<tr><td>${escapeHtml(t.codigo)}</td><td>—</td><td>Turma sem mediador responsável</td><td><a href="turmas.html">Gestão Turmas</a></td></tr>`),
    ...g.ucsComFormadorInativo.map((u) => `<tr><td>${escapeHtml(u.turma)}</td><td>${escapeHtml(u.uc)}</td><td>Formador inativo (${escapeHtml(u.formador)})</td><td><a href="turmaUcs.html?turmaId=${u.turmaId}">UCs da turma</a></td></tr>`),
    ...g.ucsSemAulasFuturas.map((u) => `<tr><td>${escapeHtml(u.turma)}</td><td>${escapeHtml(u.uc)}</td><td>${escapeHtml(u.motivo)}</td><td><a href="agenda.html">Agenda</a></td></tr>`),
  ];
  return (
    grelha([
      cartao(g.totalTurmasSemMediador, "Turmas sem mediador", "turmas.html", nivel(g.totalTurmasSemMediador)),
      cartao(g.totalUcsComFormadorInativo, "UCs com formador inativo", "turmas.html", nivel(g.totalUcsComFormadorInativo, "alerta")),
      cartao(g.totalUcsSemAulasFuturas, "UCs sem aulas futuras", "agenda.html", nivel(g.totalUcsSemAulasFuturas)),
    ]) + (linhas.length ? cartaoTabela("Pendências de gestão", ["Turma", "UC", "Problema", "Onde resolver"], linhas, "") : "")
  );
}

async function iniciar() {
  const cabecalho = document.querySelector(".content-area .header-flex");
  const role = getUser()?.role;
  if (!cabecalho || !role) return;

  try {
    const resumo = await api("/painel/resumo");
    const html = { FORMADOR: htmlFormador, FORMANDO: htmlFormando, COORDENADOR: htmlCoordenacao }[role]?.(resumo);
    if (!html) return;

    const contentor = document.createElement("div");
    contentor.id = "painel-resumo";
    contentor.style.marginBottom = "10px";
    contentor.innerHTML = html;
    cabecalho.after(contentor);
  } catch (error) {
    console.error("Painel de resumo indisponível:", error.message);
  }
}

iniciar();
