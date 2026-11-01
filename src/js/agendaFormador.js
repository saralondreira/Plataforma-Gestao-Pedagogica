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
    desenharGrelha(dias);
  } catch (error) {
    showToast(error.message || "Erro ao carregar a disponibilidade.", "error");
  }
}

function desenharGrelha(dias) {
  grid.innerHTML = "";

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

    dias.forEach((dia) => {
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

      celula.addEventListener("click", () => alternarBloco(dataISO, hora, bloco));
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

async function alternarBloco(dataISO, hora, blocoAtual) {
  if (blocoAtual && blocoAtual.aula) {
    showToast("Este bloco já tem uma aula agendada — não pode ser alterado aqui.", "error");
    return;
  }

  try {
    if (!blocoAtual) {
      // Por definir -> Livre
      await api("/disponibilidade", { method: "POST", body: { data: dataISO, horaInicio: hora, estado: "LIVRE" } });
    } else if (blocoAtual.estado === "LIVRE") {
      // Livre -> Bloqueado (com motivo opcional)
      const motivo = prompt("Motivo do bloqueio (opcional, ex.: Almoço, Jantar):", blocoAtual.motivo || "");
      if (motivo === null) return; // cancelado — não bloquear o bloco
      await api("/disponibilidade", {
        method: "POST",
        body: { data: dataISO, horaInicio: hora, estado: "BLOQUEADO", motivo },
      });
    } else {
      // Bloqueado -> por definir (apaga o bloco)
      await api(`/disponibilidade/${blocoAtual.id}`, { method: "DELETE" });
    }
    carregarSemana();
  } catch (error) {
    showToast(error.message || "Erro ao atualizar o bloco.", "error");
  }
}

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
