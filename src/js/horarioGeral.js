import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { DIAS_SEMANA, formatarDataISO, inicioDaSemana, diasDaSemana, formatarIntervaloSemana } from "./calendarioSemana.js";

const HORA_INICIO = 8;
const HORA_FIM = 21;

const grid = document.getElementById("horario-grid");
const labelSemana = document.getElementById("horario-semana-label");
const resumo = document.getElementById("horario-resumo");
const filtroTurma = document.getElementById("filtro-turma");
const filtroFormador = document.getElementById("filtro-formador");
let semana = inicioDaSemana(new Date());

async function carregarFiltros() {
  try {
    const [turmas, formadores] = await Promise.all([api("/turmas"), api("/formadores")]);
    turmas.forEach((t) => filtroTurma.append(new Option(t.codigo, t.id)));
    formadores.forEach((f) => filtroFormador.append(new Option(f.nome, f.id)));
  } catch (error) {
    showToast(error.message || "Erro ao carregar os filtros.", "error");
  }
}

async function carregar() {
  const dias = diasDaSemana(semana);
  labelSemana.textContent = formatarIntervaloSemana(semana);

  const params = new URLSearchParams({ de: formatarDataISO(dias[0]), ate: formatarDataISO(dias[6]) });
  if (filtroTurma.value) params.set("turmaId", filtroTurma.value);
  if (filtroFormador.value) params.set("formadorId", filtroFormador.value);

  try {
    const aulas = await api(`/aulas?${params}`);
    resumo.textContent = `${aulas.length} aula(s) nesta semana.`;

    // Várias aulas podem coincidir à mesma hora (turmas diferentes) — cada célula é uma lista.
    const porChave = new Map();
    aulas.forEach((a) => {
      const chave = `${a.data.slice(0, 10)}|${a.horaInicio}`;
      porChave.set(chave, [...(porChave.get(chave) || []), a]);
    });

    grid.innerHTML = "";
    grid.appendChild(document.createElement("div"));
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
        const doBloco = porChave.get(`${formatarDataISO(dia)}|${hora}`) || [];
        const celula = document.createElement("div");
        celula.className = "agenda-celula";
        celula.style.cursor = "default";
        if (doBloco.length) {
          celula.classList.add("agendado");
          celula.style.flexDirection = "column";
          celula.style.gap = "2px";
          celula.innerHTML = doBloco
            .map((a) => `<div title="${escapeHtml(a.turmaUc.uc.nome)} — ${escapeHtml(a.turmaUc.formador.nome)} (${a.modalidade === "ONLINE" ? "Online" : "Presencial"})"><strong>${escapeHtml(a.turmaUc.uc.abreviatura)}</strong> ${escapeHtml(a.turmaUc.turma.codigo)}<br>${escapeHtml(a.turmaUc.formador.nome.split(" ")[0])}</div>`)
            .join("");
        } else {
          celula.classList.add("indisponivel");
        }
        grid.appendChild(celula);
      });
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar o horário.", "error");
  }
}

const mudar = (dias) => {
  semana = new Date(semana.getFullYear(), semana.getMonth(), semana.getDate() + dias);
  carregar();
};
document.getElementById("horario-semana-anterior").addEventListener("click", () => mudar(-7));
document.getElementById("horario-semana-seguinte").addEventListener("click", () => mudar(7));
document.getElementById("horario-semana-hoje").addEventListener("click", () => {
  semana = inicioDaSemana(new Date());
  carregar();
});
filtroTurma.addEventListener("change", carregar);
filtroFormador.addEventListener("change", carregar);

carregarFiltros();
carregar();
