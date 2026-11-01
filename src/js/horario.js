import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { descarregarIcs, intervaloDeExportacao } from "./ics.js";
import { DIAS_SEMANA, formatarDataISO, inicioDaSemana, diasDaSemana, formatarIntervaloSemana } from "./calendarioSemana.js";

const HORA_INICIO = 8;
const HORA_FIM = 21;

const role = getUser()?.role;
const grid = document.getElementById("horario-grid");
const labelSemana = document.getElementById("horario-semana-label");
let semana = inicioDaSemana(new Date());

document.getElementById("subtitulo-pagina").textContent =
  role === "FORMADOR" ? "As aulas que lecionas, por semana." : "As aulas da tua turma, por semana.";

async function carregar() {
  const dias = diasDaSemana(semana);
  labelSemana.textContent = formatarIntervaloSemana(semana);

  try {
    const aulas = await api(`/aulas/minhas?de=${formatarDataISO(dias[0])}&ate=${formatarDataISO(dias[6])}`);
    const porChave = new Map(aulas.map((a) => [`${a.data.slice(0, 10)}|${a.horaInicio}`, a]));

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
        const aula = porChave.get(`${formatarDataISO(dia)}|${hora}`);
        const celula = document.createElement("div");
        celula.className = "agenda-celula";
        if (aula) {
          const modalidade = aula.modalidade === "ONLINE" ? "Online" : "Presencial";
          const detalhe = role === "FORMADOR" ? aula.turmaUc.turma.codigo : aula.turmaUc.formador.nome.split(" ")[0];
          celula.classList.add("agendado");
          celula.style.fontSize = "11px";
          celula.title = `${aula.turmaUc.uc.nome} — ${aula.turmaUc.formador.nome} (${modalidade})`;
          celula.innerHTML = `<strong>${escapeHtml(aula.turmaUc.uc.abreviatura)}</strong><br>${escapeHtml(detalhe)}`;
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

document.getElementById("btn-exportar-ics").addEventListener("click", async () => {
  try {
    const aulas = await api(`/aulas/minhas?${intervaloDeExportacao()}`);
    if (aulas.length === 0) {
      showToast("Não há aulas marcadas nos próximos 6 meses.", "error");
      return;
    }
    descarregarIcs(aulas, "O meu horário", "o-meu-horario.ics");
  } catch (error) {
    showToast(error.message || "Erro ao exportar o horário.", "error");
  }
});

document.getElementById("btn-link-calendario").addEventListener("click", async () => {
  try {
    const { url } = await api("/calendario/link", { method: "POST" });
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado! No teu calendário escolhe 'Adicionar por URL' e cola-o. Trata-o como privado — mudar a password invalida-o.", "success");
    } catch {
      window.prompt("Copia este link e cola-o em 'Adicionar calendário por URL' (trata-o como privado):", url);
    }
  } catch (error) {
    showToast(error.message || "Erro ao gerar o link.", "error");
  }
});

document.getElementById("horario-semana-anterior").addEventListener("click", () => mudar(-7));
document.getElementById("horario-semana-seguinte").addEventListener("click", () => mudar(7));
document.getElementById("horario-semana-hoje").addEventListener("click", () => {
  semana = inicioDaSemana(new Date());
  carregar();
});

carregar();
