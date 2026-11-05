import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { DIAS_SEMANA, formatarDataISO, inicioDaSemana, diasDaSemana, formatarIntervaloSemana } from "./calendarioSemana.js";

const HORA_INICIO = 8;
const HORA_FIM = 21; // inclusive

const grid = document.getElementById("agenda-grid");
const labelSemana = document.getElementById("agenda-semana-label");
const btnAnterior = document.getElementById("btn-semana-anterior");
const btnSeguinte = document.getElementById("btn-semana-seguinte");
const btnHoje = document.getElementById("btn-semana-hoje");

let semanaAtual = inicioDaSemana(new Date());
let blocosPorChave = new Map(); // "YYYY-MM-DD|hora" -> bloco

// Seleção de vários horários (clicar ou arrastar). Chave "YYYY-MM-DD|hora" -> célula.
const selecionadas = new Map();
let arrastar = null; // null = parado; true = a juntar células; false = a tirar células da seleção
let origem = null; // célula onde começou o arrasto (o arrasto seleciona o retângulo até à célula atual)
let baseSelecao = new Set(); // o que já estava selecionado quando o arrasto começou
const celulasLivres = new Map(); // chave -> célula, só as que se podem selecionar (sem aula)
const acoes = {
  texto: document.getElementById("agenda-selecao-texto"),
  motivo: document.getElementById("agenda-motivo"),
  livre: document.getElementById("btn-marcar-livre"),
  bloqueado: document.getElementById("btn-marcar-bloqueado"),
  limpar: document.getElementById("btn-limpar-blocos"),
  cancelar: document.getElementById("btn-cancelar-selecao"),
};

function chave(dataISO, hora) {
  return `${dataISO}|${hora}`;
}

async function carregarSemana() {
  if (!grid) return;

  const dias = diasDaSemana(semanaAtual);
  const de = formatarDataISO(dias[0]);
  const ate = formatarDataISO(dias[6]);

  labelSemana.textContent = formatarIntervaloSemana(semanaAtual);

  try {
    const blocos = await api(`/disponibilidade/minha?de=${de}&ate=${ate}`);
    blocosPorChave = new Map();
    blocos.forEach((bloco) => {
      const dataISO = bloco.data.slice(0, 10);
      blocosPorChave.set(chave(dataISO, bloco.horaInicio), bloco);
    });
    selecionadas.clear();
    desenharGrelha(dias);
    atualizarAcoes();
  } catch (error) {
    showToast(error.message || "Erro ao carregar a disponibilidade.", "error");
  }
}

function desenharGrelha(dias) {
  grid.innerHTML = "";
  celulasLivres.clear();

  // Cabeçalho: canto vazio + 7 dias
  const canto = document.createElement("div");
  grid.appendChild(canto);

  dias.forEach((dia) => {
    const dataISO = formatarDataISO(dia);
    const diaLabel = `${DIAS_SEMANA[dia.getDay()]} ${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`;
    const cab = document.createElement("div");
    cab.className = "agenda-grid-cabecalho";
    cab.innerHTML = `${DIAS_SEMANA[dia.getDay()]}<span class="dia-numero">${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}</span>`;
    const btnBloquearDia = document.createElement("button");
    btnBloquearDia.type = "button";
    btnBloquearDia.className = "btn-bloquear-dia";
    btnBloquearDia.textContent = "Bloquear dia";
    btnBloquearDia.title = "Bloquear todos os blocos ainda livres ou por definir deste dia";
    btnBloquearDia.addEventListener("click", () => bloquearDiaInteiro(dataISO, diaLabel));
    cab.appendChild(btnBloquearDia);
    grid.appendChild(cab);
  });

  for (let hora = HORA_INICIO; hora <= HORA_FIM; hora++) {
    const labelHora = document.createElement("div");
    labelHora.className = "agenda-hora-label";
    labelHora.textContent = `${String(hora).padStart(2, "0")}:00`;
    grid.appendChild(labelHora);

    dias.forEach((dia, coluna) => {
      const dataISO = formatarDataISO(dia);
      const bloco = blocosPorChave.get(chave(dataISO, hora));
      const celula = document.createElement("div");
      celula.className = "agenda-celula";

      if (bloco && bloco.aula) {
        celula.classList.add("agendado");
        celula.textContent = `Aula`;
        celula.title = "Este bloco já tem uma aula agendada pela coordenação.";
      } else if (bloco && bloco.estado === "BLOQUEADO") {
        celula.classList.add("bloqueado");
        celula.textContent = bloco.motivo || "Bloqueado";
      } else if (bloco && bloco.estado === "LIVRE") {
        celula.classList.add("livre");
        celula.textContent = "Livre";
      }

      const k = chave(dataISO, hora);
      celula.dataset.chave = k;
      if (bloco && bloco.aula) {
        celula.addEventListener("mousedown", () =>
          showToast("Este bloco já tem uma aula agendada, não pode ser alterado aqui.", "error")
        );
      } else {
        celula.tabIndex = 0;
        celula.dataset.coluna = coluna;
        celula.dataset.hora = hora;
        celulasLivres.set(k, celula);
        celula.addEventListener("mousedown", (e) => {
          e.preventDefault(); // evita selecionar texto ao arrastar
          arrastar = !selecionadas.has(k);
          origem = celula;
          baseSelecao = new Set(selecionadas.keys());
          selecionarRetangulo(celula);
        });
        celula.addEventListener("mouseenter", () => {
          if (arrastar !== null) selecionarRetangulo(celula);
        });
        celula.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            definirSelecao(k, celula, !selecionadas.has(k));
          }
        });
      }
      grid.appendChild(celula);
    });
  }
}

async function bloquearDiaInteiro(dataISO, diaLabel) {
  const resposta = prompt(
    `Motivo do bloqueio para ${diaLabel} (aplica-se a todos os blocos ainda livres ou por definir desse dia; deixa em branco se não quiseres indicar motivo):`,
    ""
  );
  if (resposta === null) return; // cancelado

  const motivo = resposta;
  const horasParaBloquear = [];
  for (let hora = HORA_INICIO; hora <= HORA_FIM; hora++) {
    const bloco = blocosPorChave.get(chave(dataISO, hora));
    if (bloco && bloco.aula) continue; // já tem aula agendada — não mexer
    if (bloco && bloco.estado === "BLOQUEADO") continue; // já está bloqueado
    horasParaBloquear.push(hora);
  }

  if (horasParaBloquear.length === 0) {
    showToast("Não há blocos por bloquear neste dia — está tudo já bloqueado ou com aulas agendadas.", "error");
    return;
  }

  if (!confirm(`Bloquear ${horasParaBloquear.length} bloco(s) de ${diaLabel}? Os blocos com aulas já agendadas mantêm-se como estão.`)) {
    return;
  }

  const resultados = await Promise.allSettled(
    horasParaBloquear.map((hora) =>
      api("/disponibilidade", { method: "POST", body: { data: dataISO, horaInicio: hora, estado: "BLOQUEADO", motivo } })
    )
  );
  const falhas = resultados.filter((r) => r.status === "rejected").length;

  if (falhas === 0) {
    showToast(`Dia bloqueado (${resultados.length} bloco(s)).`, "success");
  } else {
    showToast(`${resultados.length - falhas} bloco(s) bloqueados, ${falhas} falharam — tenta outra vez.`, "error");
  }

  carregarSemana();
}

function definirSelecao(k, celula, selecionar) {
  if (selecionar) selecionadas.set(k, celula);
  else selecionadas.delete(k);
  celula.classList.toggle("selecionada", selecionar);
  atualizarAcoes();
}

// Seleciona (ou tira da seleção) todas as células do retângulo entre a origem do arrasto e a célula atual.
function selecionarRetangulo(atual) {
  const c1 = Math.min(origem.dataset.coluna, atual.dataset.coluna);
  const c2 = Math.max(origem.dataset.coluna, atual.dataset.coluna);
  const h1 = Math.min(origem.dataset.hora, atual.dataset.hora);
  const h2 = Math.max(origem.dataset.hora, atual.dataset.hora);
  celulasLivres.forEach((celula, k) => {
    const dentro =
      celula.dataset.coluna >= c1 && celula.dataset.coluna <= c2 && Number(celula.dataset.hora) >= h1 && Number(celula.dataset.hora) <= h2;
    const selecionar = arrastar ? baseSelecao.has(k) || dentro : baseSelecao.has(k) && !dentro;
    if (selecionar) selecionadas.set(k, celula);
    else selecionadas.delete(k);
    celula.classList.toggle("selecionada", selecionar);
  });
  atualizarAcoes();
}

function atualizarAcoes() {
  if (!acoes.texto) return;
  const n = selecionadas.size;
  acoes.texto.textContent = n === 0 ? "Nenhum horário selecionado" : `${n} horário(s) selecionado(s)`;
  [acoes.livre, acoes.bloqueado, acoes.limpar, acoes.cancelar].forEach((b) => (b.disabled = n === 0));
}

document.addEventListener("mouseup", () => {
  arrastar = null;
  origem = null;
});

// Aplica "LIVRE", "BLOQUEADO" ou "LIMPAR" (apaga o bloco) a todos os horários selecionados.
async function aplicarSelecao(acao) {
  const motivo = acoes.motivo.value.trim();
  const pedidos = [];
  selecionadas.forEach((_, k) => {
    const [dataISO, hora] = k.split("|");
    const bloco = blocosPorChave.get(k);
    if (acao === "LIMPAR") {
      if (bloco) pedidos.push(api(`/disponibilidade/${bloco.id}`, { method: "DELETE" }));
    } else {
      pedidos.push(
        api("/disponibilidade", {
          method: "POST",
          body: { data: dataISO, horaInicio: Number(hora), estado: acao, ...(acao === "BLOQUEADO" ? { motivo } : {}) },
        })
      );
    }
  });

  if (pedidos.length === 0) {
    showToast("Os horários selecionados já estão por definir.", "error");
    return;
  }

  const resultados = await Promise.allSettled(pedidos);
  const falhas = resultados.filter((r) => r.status === "rejected").length;
  if (falhas === 0) {
    showToast(`${resultados.length} horário(s) atualizado(s).`, "success");
  } else {
    showToast(`${resultados.length - falhas} atualizado(s), ${falhas} falharam. Tenta outra vez.`, "error");
  }
  acoes.motivo.value = "";
  carregarSemana();
}

acoes.livre?.addEventListener("click", () => aplicarSelecao("LIVRE"));
acoes.bloqueado?.addEventListener("click", () => aplicarSelecao("BLOQUEADO"));
acoes.limpar?.addEventListener("click", () => aplicarSelecao("LIMPAR"));
acoes.cancelar?.addEventListener("click", () => {
  selecionadas.forEach((celula) => celula.classList.remove("selecionada"));
  selecionadas.clear();
  atualizarAcoes();
});

if (btnAnterior) {
  btnAnterior.addEventListener("click", () => {
    semanaAtual.setDate(semanaAtual.getDate() - 7);
    carregarSemana();
  });
}
if (btnSeguinte) {
  btnSeguinte.addEventListener("click", () => {
    semanaAtual.setDate(semanaAtual.getDate() + 7);
    carregarSemana();
  });
}
if (btnHoje) {
  btnHoje.addEventListener("click", () => {
    semanaAtual = inicioDaSemana(new Date());
    carregarSemana();
  });
}

carregarSemana();
