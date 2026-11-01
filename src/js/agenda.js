import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { descarregarIcs, intervaloDeExportacao } from "./ics.js";
import { DIAS_SEMANA, formatarDataISO, inicioDaSemana, diasDaSemana, formatarIntervaloSemana } from "./calendarioSemana.js";

const HORA_INICIO = 8;
const HORA_FIM = 21; // inclusive

const selectTurma = document.getElementById("select-turma");
const blocoUcs = document.getElementById("bloco-ucs");
const tbodyUcs = document.querySelector("#tabela-ucs tbody");

const blocoAgendar = document.getElementById("bloco-agendar");
const tituloAgendar = document.getElementById("titulo-agendar");
const btnFecharAgendar = document.getElementById("btn-fechar-agendar");
const grid = document.getElementById("agenda-grid");
const labelSemana = document.getElementById("agenda-semana-label");
const btnAnterior = document.getElementById("btn-semana-anterior");
const btnSeguinte = document.getElementById("btn-semana-seguinte");
const btnHoje = document.getElementById("btn-semana-hoje");
const painelConfirmar = document.getElementById("painel-confirmar");
const textoBlocoSelecionado = document.getElementById("texto-bloco-selecionado");
const selectModalidade = document.getElementById("select-modalidade");
const btnConfirmarAgendamento = document.getElementById("btn-confirmar-agendamento");
const tbodyAulas = document.querySelector("#tabela-aulas tbody");

let turmaSelecionadaId = null;
// UCs geridas em "Gestão Turmas" (associação Turma+UC+Formador) — aqui só se agenda.
let turmaUcEmAgendamento = null;
let semanaAtual = inicioDaSemana(new Date());
let blocosPorChave = new Map();
// Blocos escolhidos na grelha (id -> texto). Agendar aceita vários; reagendar só um.
const blocosSelecionados = new Map();
let aulaEmReagendamento = null;

function chave(dataISO, hora) {
  return `${dataISO}|${hora}`;
}

// ---------- Turmas ----------

async function carregarTurmas() {
  if (!selectTurma) return;
  try {
    const turmas = await api("/turmas");
    selectTurma.innerHTML = '<option value="">— Seleciona —</option>';
    turmas.forEach((turma) => {
      const opt = document.createElement("option");
      opt.value = turma.id;
      opt.textContent = `${turma.codigo} — ${turma.designacao}`;
      selectTurma.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar turmas.", "error");
  }
}

if (selectTurma) {
  selectTurma.addEventListener("change", () => {
    turmaSelecionadaId = selectTurma.value || null;
    fecharPainelAgendar();
    if (turmaSelecionadaId) {
      blocoUcs.style.display = "";
      blocoHorario.style.display = "";
      carregarUCs();
      carregarHorario();
    } else {
      blocoUcs.style.display = "none";
      blocoHorario.style.display = "none";
    }
  });
}

// ---------- Horário da turma (só leitura: todas as UCs, com formador) ----------

const blocoHorario = document.getElementById("bloco-horario");
const gridHorario = document.getElementById("horario-grid");
const labelSemanaHorario = document.getElementById("horario-semana-label");
let semanaHorario = inicioDaSemana(new Date());

async function carregarHorario() {
  if (!turmaSelecionadaId || !gridHorario) return;
  const dias = diasDaSemana(semanaHorario);
  labelSemanaHorario.textContent = formatarIntervaloSemana(semanaHorario);

  try {
    const aulas = await api(`/aulas/turma/${turmaSelecionadaId}?de=${formatarDataISO(dias[0])}&ate=${formatarDataISO(dias[6])}`);
    const aulaPorChave = new Map(aulas.map((a) => [chave(a.data.slice(0, 10), a.horaInicio), a]));

    gridHorario.innerHTML = "";
    gridHorario.appendChild(document.createElement("div"));
    dias.forEach((dia) => {
      const cab = document.createElement("div");
      cab.className = "agenda-grid-cabecalho";
      cab.innerHTML = `${DIAS_SEMANA[dia.getDay()]}<span class="dia-numero">${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}</span>`;
      gridHorario.appendChild(cab);
    });

    for (let hora = HORA_INICIO; hora <= HORA_FIM; hora++) {
      const labelHora = document.createElement("div");
      labelHora.className = "agenda-hora-label";
      labelHora.textContent = `${String(hora).padStart(2, "0")}:00`;
      gridHorario.appendChild(labelHora);

      dias.forEach((dia) => {
        const aula = aulaPorChave.get(chave(formatarDataISO(dia), hora));
        const celula = document.createElement("div");
        celula.className = "agenda-celula";
        if (aula) {
          celula.classList.add("agendado");
          celula.style.fontSize = "11px";
          celula.title = `${aula.turmaUc.uc.nome} — ${aula.turmaUc.formador.nome} (${aula.modalidade === "ONLINE" ? "Online" : "Presencial"})`;
          celula.innerHTML = `<strong>${escapeHtml(aula.turmaUc.uc.abreviatura)}</strong><br>${escapeHtml(aula.turmaUc.formador.nome.split(" ")[0])}`;
        } else {
          celula.classList.add("indisponivel");
        }
        gridHorario.appendChild(celula);
      });
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar o horário da turma.", "error");
  }
}

[
  ["horario-semana-anterior", () => (semanaHorario = new Date(semanaHorario.getFullYear(), semanaHorario.getMonth(), semanaHorario.getDate() - 7))],
  ["horario-semana-seguinte", () => (semanaHorario = new Date(semanaHorario.getFullYear(), semanaHorario.getMonth(), semanaHorario.getDate() + 7))],
  ["horario-semana-hoje", () => (semanaHorario = inicioDaSemana(new Date()))],
].forEach(([id, mudar]) => {
  document.getElementById(id)?.addEventListener("click", () => {
    mudar();
    carregarHorario();
  });
});

// Depois de repetir a semana: para as aulas que falharam por o formador não ter
// marcado a hora, oferece avisá-lo por email (um email por formador).
async function oferecerAvisoDeDisponibilidade(falhadas) {
  const porFormador = new Map();
  falhadas
    .filter((f) => f.codigo === "SEM_BLOCO" && f.formadorId)
    .forEach((f) => porFormador.set(f.formadorId, [...(porFormador.get(f.formadorId) || []), f.quando]));
  if (porFormador.size === 0) return;

  const total = [...porFormador.values()].reduce((n, q) => n + q.length, 0);
  if (!confirm(`${total} aula(s) ficaram por agendar porque o formador não marcou a hora. Avisar ${porFormador.size} formador(es) por email para a marcarem?`)) return;
  try {
    await Promise.all([...porFormador].map(([formadorId, quando]) => api("/disponibilidade/pedir-marcacao", { method: "POST", body: { formadorId, quando } })));
    showToast("Formadores avisados.", "success");
  } catch (error) {
    showToast(error.message || "Erro ao avisar os formadores.", "error");
  }
}

document.getElementById("btn-repetir-semana")?.addEventListener("click", async () => {
  if (!turmaSelecionadaId) return;
  const resposta = window.prompt("Repetir as aulas da semana visível durante quantas semanas seguintes? (1 a 16)", "4");
  if (resposta === null) return;
  const numSemanas = Number(resposta);
  if (!Number.isInteger(numSemanas) || numSemanas < 1 || numSemanas > 16) {
    showToast("Indica um número de semanas entre 1 e 16.", "error");
    return;
  }
  try {
    const r = await api("/aulas/repetir-semana", {
      method: "POST",
      body: { turmaId: turmaSelecionadaId, semanaDe: formatarDataISO(semanaHorario), numSemanas },
    });
    const falhas = r.falhadas.length
      ? ` ${r.falhadas.length} não agendada(s) — ex.: ${r.falhadas[0].quando} (${r.falhadas[0].motivo})`
      : "";
    showToast(`${r.criadas} aula(s) criada(s).${falhas}`, r.criadas ? "success" : "error");
    carregarUCs();
    carregarHorario();
    await oferecerAvisoDeDisponibilidade(r.falhadas);
  } catch (error) {
    showToast(error.message || "Erro ao repetir a semana.", "error");
  }
});

document.getElementById("btn-exportar-ics-turma")?.addEventListener("click", async () => {
  if (!turmaSelecionadaId) return;
  try {
    const aulas = await api(`/aulas/turma/${turmaSelecionadaId}?${intervaloDeExportacao()}`);
    if (aulas.length === 0) {
      showToast("Esta turma não tem aulas marcadas nos próximos 6 meses.", "error");
      return;
    }
    const codigo = selectTurma.options[selectTurma.selectedIndex].textContent.split(" — ")[0];
    descarregarIcs(aulas, `Horário ${codigo}`, `horario-${codigo}.ics`);
  } catch (error) {
    showToast(error.message || "Erro ao exportar o horário.", "error");
  }
});

// ---------- Ocupação do formador (só leitura: livre / bloqueado / aula) ----------

const selectFormadorOcupacao = document.getElementById("select-formador-ocupacao");
const conteudoOcupacao = document.getElementById("ocupacao-conteudo");
const gridOcupacao = document.getElementById("ocupacao-grid");
const labelSemanaOcupacao = document.getElementById("ocupacao-semana-label");
const resumoOcupacao = document.getElementById("ocupacao-resumo");
let semanaOcupacao = inicioDaSemana(new Date());

async function carregarFormadoresOcupacao() {
  if (!selectFormadorOcupacao) return;
  try {
    const formadores = await api("/formadores");
    formadores.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.nome;
      selectFormadorOcupacao.appendChild(opt);
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar formadores.", "error");
  }
}

async function carregarOcupacao() {
  const formadorId = selectFormadorOcupacao?.value;
  conteudoOcupacao.style.display = formadorId ? "" : "none";
  if (!formadorId) return;

  const dias = diasDaSemana(semanaOcupacao);
  labelSemanaOcupacao.textContent = formatarIntervaloSemana(semanaOcupacao);

  try {
    const blocos = await api(`/disponibilidade/formador/${formadorId}?de=${formatarDataISO(dias[0])}&ate=${formatarDataISO(dias[6])}`);
    const porChave = new Map(blocos.map((b) => [chave(b.data.slice(0, 10), b.horaInicio), b]));
    const contagem = { LIVRE: 0, BLOQUEADO: 0, AULA: 0 };
    blocos.forEach((b) => (contagem[b.aula ? "AULA" : b.estado] += 1));
    resumoOcupacao.textContent = `Nesta semana: ${contagem.AULA}h com aulas, ${contagem.LIVRE}h livres, ${contagem.BLOQUEADO}h bloqueadas.`;

    gridOcupacao.innerHTML = "";
    gridOcupacao.appendChild(document.createElement("div"));
    dias.forEach((dia) => {
      const cab = document.createElement("div");
      cab.className = "agenda-grid-cabecalho";
      cab.innerHTML = `${DIAS_SEMANA[dia.getDay()]}<span class="dia-numero">${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}</span>`;
      gridOcupacao.appendChild(cab);
    });

    for (let hora = HORA_INICIO; hora <= HORA_FIM; hora++) {
      const labelHora = document.createElement("div");
      labelHora.className = "agenda-hora-label";
      labelHora.textContent = `${String(hora).padStart(2, "0")}:00`;
      gridOcupacao.appendChild(labelHora);

      dias.forEach((dia) => {
        const bloco = porChave.get(chave(formatarDataISO(dia), hora));
        const celula = document.createElement("div");
        celula.className = "agenda-celula";
        if (bloco && bloco.aula) {
          celula.classList.add("agendado");
          celula.style.fontSize = "11px";
          celula.title = `${bloco.aula.turmaUc.uc.nome} (${bloco.aula.turmaUc.turma.codigo})`;
          celula.innerHTML = `<strong>${escapeHtml(bloco.aula.turmaUc.uc.abreviatura)}</strong><br>${escapeHtml(bloco.aula.turmaUc.turma.codigo)}`;
        } else if (bloco && bloco.estado === "BLOQUEADO") {
          celula.classList.add("bloqueado");
          celula.textContent = bloco.motivo || "Bloqueado";
        } else if (bloco && bloco.estado === "LIVRE") {
          celula.classList.add("livre");
          celula.textContent = "Livre";
        } else {
          celula.classList.add("indisponivel");
        }
        gridOcupacao.appendChild(celula);
      });
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar a ocupação do formador.", "error");
  }
}

if (selectFormadorOcupacao) {
  selectFormadorOcupacao.addEventListener("change", carregarOcupacao);
  const mudarOcupacao = (dias) => {
    semanaOcupacao = new Date(semanaOcupacao.getFullYear(), semanaOcupacao.getMonth(), semanaOcupacao.getDate() + dias);
    carregarOcupacao();
  };
  document.getElementById("ocupacao-semana-anterior").addEventListener("click", () => mudarOcupacao(-7));
  document.getElementById("ocupacao-semana-seguinte").addEventListener("click", () => mudarOcupacao(7));
  document.getElementById("ocupacao-semana-hoje").addEventListener("click", () => {
    semanaOcupacao = inicioDaSemana(new Date());
    carregarOcupacao();
  });
  carregarFormadoresOcupacao();
}

// ---------- UCs desta turma (associações Turma+UC, geridas em Gestão Turmas) ----------

async function carregarUCs() {
  if (!turmaSelecionadaId) return;
  try {
    const associacoes = await api(`/turma-ucs/turma/${turmaSelecionadaId}`);
    tbodyUcs.innerHTML = "";

    if (associacoes.length === 0) {
      tbodyUcs.innerHTML =
        '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Ainda não há UCs associadas a esta turma. Associa UCs em "Gestão Turmas".</td></tr>';
    } else {
      associacoes.forEach((assoc) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${escapeHtml(assoc.uc.abreviatura)}</strong></td>
          <td>${escapeHtml(assoc.uc.nome)}</td>
          <td>${escapeHtml(assoc.formador?.nome ?? "—")}</td>
          <td>${assoc.uc.cargaHoraria}h</td>
          <td>${assoc.horasDadas}h</td>
          <td><span class="badge ${assoc.horasEmFalta === 0 ? "green" : "yellow"}">${assoc.horasEmFalta}h</span></td>
          <td>
            <button class="btn-icon btn-agendar-uc" data-id="${assoc.id}" title="Agendar aula"><i class="ph ph-calendar-plus"></i></button>
          </td>
        `;
        tbodyUcs.appendChild(tr);
      });
    }

    // Se a UC que está a ser agendada pertence a esta turma, atualiza o cabeçalho (horas mudam).
    if (turmaUcEmAgendamento) {
      const atual = associacoes.find((a) => a.id === turmaUcEmAgendamento.id);
      if (atual) {
        turmaUcEmAgendamento = atual;
        atualizarTituloAgendar();
      }
    }

    ligarAcoesUcs();
  } catch (error) {
    showToast(error.message || "Erro ao carregar UCs.", "error");
  }
}

function ligarAcoesUcs() {
  document.querySelectorAll(".btn-agendar-uc").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = Number(botao.getAttribute("data-id"));
      const associacoes = await api(`/turma-ucs/turma/${turmaSelecionadaId}`);
      const assoc = associacoes.find((a) => a.id === id);
      if (assoc) abrirPainelAgendar(assoc);
    });
  });
}

// ---------- Painel de agendamento ----------

function atualizarTituloAgendar() {
  if (!turmaUcEmAgendamento) return;
  tituloAgendar.textContent = `Agendar aula — ${turmaUcEmAgendamento.uc.abreviatura} · ${turmaUcEmAgendamento.uc.nome} (${turmaUcEmAgendamento.horasDadas}h dadas / ${turmaUcEmAgendamento.horasEmFalta}h em falta)`;
}

function abrirPainelAgendar(assoc) {
  // Um reagendamento em curso pertence à UC anterior: não pode passar para a nova.
  if (aulaEmReagendamento) terminarReagendamento();
  turmaUcEmAgendamento = assoc;
  semanaAtual = inicioDaSemana(new Date());
  blocosSelecionados.clear();
  painelConfirmar.style.display = "none";
  atualizarTituloAgendar();
  blocoAgendar.style.display = "";
  blocoAgendar.scrollIntoView({ behavior: "smooth", block: "start" });
  carregarSemanaAgendamento();
  carregarAulasDaUC();
}

function fecharPainelAgendar() {
  turmaUcEmAgendamento = null;
  if (aulaEmReagendamento) terminarReagendamento();
  blocoAgendar.style.display = "none";
  painelConfirmar.style.display = "none";
}

if (btnFecharAgendar) {
  btnFecharAgendar.addEventListener("click", fecharPainelAgendar);
}

async function carregarSemanaAgendamento() {
  if (!turmaUcEmAgendamento || !grid) return;

  const dias = diasDaSemana(semanaAtual);
  const de = formatarDataISO(dias[0]);
  const ate = formatarDataISO(dias[6]);
  labelSemana.textContent = formatarIntervaloSemana(semanaAtual);

  try {
    const blocos = await api(`/disponibilidade/formador/${turmaUcEmAgendamento.formadorId}?de=${de}&ate=${ate}`);
    blocosPorChave = new Map();
    blocos.forEach((bloco) => {
      const dataISO = bloco.data.slice(0, 10);
      blocosPorChave.set(chave(dataISO, bloco.horaInicio), bloco);
    });
    desenharGrelhaAgendamento(dias);
  } catch (error) {
    showToast(error.message || "Erro ao carregar a disponibilidade do formador.", "error");
  }
}

function desenharGrelhaAgendamento(dias) {
  grid.innerHTML = "";

  const canto = document.createElement("div");
  grid.appendChild(canto);

  dias.forEach((dia) => {
    const cab = document.createElement("div");
    cab.className = "agenda-grid-cabecalho";
    cab.innerHTML = `${DIAS_SEMANA[dia.getDay()]}<span class="dia-numero">${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}</span>`;
    grid.appendChild(cab);
  });

  for (let hora = HORA_INICIO; hora <= HORA_FIM; hora++) {
    const labelHora = document.createElement("div");
    labelHora.className = "agenda-hora-label";
    labelHora.textContent = `${String(hora).padStart(2, "0")}:00`;
    grid.appendChild(labelHora);

    dias.forEach((dia) => {
      const dataISO = formatarDataISO(dia);
      const bloco = blocosPorChave.get(chave(dataISO, hora));
      const celula = document.createElement("div");
      celula.className = "agenda-celula";

      if (bloco && bloco.aula) {
        celula.classList.add("agendado");
        celula.textContent = "Aula";
      } else if (bloco && bloco.estado === "BLOQUEADO") {
        celula.classList.add("bloqueado");
        celula.textContent = bloco.motivo || "Bloqueado";
      } else if (bloco && bloco.estado === "LIVRE") {
        celula.classList.add("livre", "selecionavel");
        celula.textContent = "Livre";
        if (blocosSelecionados.has(bloco.id)) celula.classList.add("selecionada");
        celula.addEventListener("click", () => selecionarBloco(bloco, dataISO, hora));
      } else {
        celula.classList.add("indisponivel");
      }

      grid.appendChild(celula);
    });
  }
}

function atualizarTextoSelecao() {
  const textos = [...blocosSelecionados.values()];
  textoBlocoSelecionado.textContent = textos.length > 3 ? `${textos.length} blocos (${textos.slice(0, 3).join("; ")}…)` : textos.join("; ");
  btnConfirmarAgendamento.textContent = aulaEmReagendamento
    ? "Confirmar novo horário"
    : textos.length > 1
      ? `Agendar ${textos.length} aulas`
      : "Confirmar agendamento";
  painelConfirmar.style.display = textos.length ? "" : "none";
}

// Clicar num bloco livre seleciona-o; clicar outra vez tira-o. Ao reagendar só
// pode haver um.
function selecionarBloco(bloco, dataISO, hora) {
  if (blocosSelecionados.has(bloco.id)) {
    blocosSelecionados.delete(bloco.id);
  } else {
    if (aulaEmReagendamento) blocosSelecionados.clear();
    const [ano, mes, dia] = dataISO.split("-");
    blocosSelecionados.set(bloco.id, `${dia}/${mes}/${ano} ${String(hora).padStart(2, "0")}:00`);
  }
  atualizarTextoSelecao();
  carregarSemanaAgendamento();
}

if (btnConfirmarAgendamento) {
  btnConfirmarAgendamento.addEventListener("click", async () => {
    if (!turmaUcEmAgendamento || blocosSelecionados.size === 0) return;
    const ids = [...blocosSelecionados.keys()];
    try {
      if (aulaEmReagendamento) {
        await api(`/aulas/${aulaEmReagendamento}/reagendar`, {
          method: "PATCH",
          body: { disponibilidadeId: ids[0], modalidade: selectModalidade.value },
        });
        showToast("Aula reagendada com sucesso!", "success");
        terminarReagendamento();
      } else if (ids.length === 1) {
        await api("/aulas", {
          method: "POST",
          body: { turmaUcId: turmaUcEmAgendamento.id, disponibilidadeId: ids[0], modalidade: selectModalidade.value },
        });
        showToast("Aula agendada com sucesso!", "success");
      } else {
        const { criadas, falhadas } = await api("/aulas/lote", {
          method: "POST",
          body: { turmaUcId: turmaUcEmAgendamento.id, disponibilidadeIds: ids, modalidade: selectModalidade.value },
        });
        const falhas = falhadas.length ? ` Não agendadas: ${falhadas.length} (${falhadas[0].motivo}${falhadas.length > 1 ? " …" : ""})` : "";
        showToast(`${criadas} aula(s) agendada(s).${falhas}`, criadas ? "success" : "error");
      }
      blocosSelecionados.clear();
      atualizarTextoSelecao();
      carregarSemanaAgendamento();
      carregarAulasDaUC();
      carregarUCs();
      carregarHorario();
    } catch (error) {
      showToast(error.message || "Erro ao agendar a aula.", "error");
    }
  });
}

function terminarReagendamento() {
  aulaEmReagendamento = null;
  btnConfirmarAgendamento.textContent = "Confirmar agendamento";
}

async function carregarAulasDaUC() {
  if (!turmaUcEmAgendamento) return;
  try {
    const aulas = await api(`/aulas/turma-uc/${turmaUcEmAgendamento.id}`);
    tbodyAulas.innerHTML = "";

    if (aulas.length === 0) {
      tbodyAulas.innerHTML =
        '<tr class="linha-vazia"><td colspan="4" style="text-align: center; padding: 15px; color: #64748b;">Ainda não há aulas agendadas.</td></tr>';
      return;
    }

    aulas.forEach((aula) => {
      const tr = document.createElement("tr");
      const dataISO = aula.data.slice(0, 10);
      tr.innerHTML = `
        <td>${dataISO}</td>
        <td>${String(aula.horaInicio).padStart(2, "0")}:00</td>
        <td><span class="badge ${aula.modalidade === "PRESENCIAL" ? "blue" : "green"}">${aula.modalidade}</span></td>
        <td>
          <button class="btn-icon btn-reagendar-aula" data-id="${aula.id}" data-modalidade="${aula.modalidade}" title="Reagendar"><i class="ph ph-arrows-clockwise"></i></button>
          <button class="btn-icon btn-cancelar-aula" data-id="${aula.id}" title="Cancelar"><i class="ph ph-x-circle"></i></button>
        </td>
      `;
      tbodyAulas.appendChild(tr);
    });

    document.querySelectorAll(".btn-reagendar-aula").forEach((botao) => {
      botao.addEventListener("click", () => {
        aulaEmReagendamento = Number(botao.getAttribute("data-id"));
        selectModalidade.value = botao.getAttribute("data-modalidade");
        blocosSelecionados.clear();
        atualizarTextoSelecao();
        btnConfirmarAgendamento.textContent = "Confirmar novo horário";
        showToast("Escolhe, na grelha, o novo bloco livre para esta aula.", "success");
        grid.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    document.querySelectorAll(".btn-cancelar-aula").forEach((botao) => {
      botao.addEventListener("click", async () => {
        if (!confirm("Cancelar esta aula? O bloco de disponibilidade fica livre outra vez.")) return;
        try {
          await api(`/aulas/${botao.getAttribute("data-id")}`, { method: "DELETE" });
          showToast("Aula cancelada.", "success");
          carregarSemanaAgendamento();
          carregarAulasDaUC();
          carregarUCs();
          carregarHorario();
        } catch (error) {
          showToast(error.message || "Erro ao cancelar aula.", "error");
        }
      });
    });
  } catch (error) {
    showToast(error.message || "Erro ao carregar aulas.", "error");
  }
}

if (btnAnterior) {
  btnAnterior.addEventListener("click", () => {
    semanaAtual.setDate(semanaAtual.getDate() - 7);
    carregarSemanaAgendamento();
  });
}
if (btnSeguinte) {
  btnSeguinte.addEventListener("click", () => {
    semanaAtual.setDate(semanaAtual.getDate() + 7);
    carregarSemanaAgendamento();
  });
}
if (btnHoje) {
  btnHoje.addEventListener("click", () => {
    semanaAtual = inicioDaSemana(new Date());
    carregarSemanaAgendamento();
  });
}

carregarTurmas();
