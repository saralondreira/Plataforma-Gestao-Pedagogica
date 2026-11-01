import { api, abrirFicheiroProtegido } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tbodyDashboard = document.querySelector("#tabela-dashboard tbody");
const filtroPrazos = document.getElementById("filtro-prazos");
const btnNovoAviso = document.getElementById("btn-novo-aviso");
const modalAviso = document.getElementById("modal-aviso");
const fecharModalAviso = document.getElementById("fechar-modal-aviso");
const formNovoAviso = document.getElementById("form-novo-aviso");
const modalTituloAviso = document.querySelector("#modal-aviso h3");
const selectFormador = document.getElementById("aviso-formador");
const selectTurma = document.getElementById("aviso-turma");

let idAvisoEmEdicao = null;

function calcularDias(dataAlvo) {
  const hoje = new Date();
  const prazo = new Date(dataAlvo);
  hoje.setHours(0, 0, 0, 0);
  prazo.setHours(0, 0, 0, 0);
  return Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
}

async function abrirModalAviso() {
  idAvisoEmEdicao = null;
  if (formNovoAviso) formNovoAviso.reset();
  if (modalTituloAviso) modalTituloAviso.textContent = "Solicitar Documento (Aviso)";
  await carregarOpcoesFormularioAviso();
  if (modalAviso) modalAviso.style.display = "flex";
}

function fecharModal() {
  if (modalAviso) modalAviso.style.display = "none";
  idAvisoEmEdicao = null;
}

async function carregarOpcoesFormularioAviso() {
  try {
    const [formadores, turmas] = await Promise.all([api("/formadores"), api("/turmas")]);

    selectFormador.innerHTML = '<option value="" disabled selected>Selecionar...</option>' +
      formadores.map((f) => `<option value="${f.id}">${f.nome}</option>`).join("");

    selectTurma.innerHTML = '<option value="" disabled selected>Selecionar...</option>' +
      turmas.map((t) => `<option value="${t.id}">${t.codigo} — ${t.designacao}</option>`).join("");
  } catch (error) {
    console.error("Erro ao carregar formadores/turmas:", error);
    showToast("Erro ao carregar formadores/turmas.", "error");
  }
}

function indicadorSubmissao(entrega) {
  if (!entrega.submissaoTipo) return "";
  if (entrega.submissaoTipo === "FICHEIRO") {
    return `<a href="#" class="link-ficheiro" data-id="${entrega.id}" title="Ficheiro submetido pelo formador"><i class="ph ph-paperclip"></i></a>`;
  }
  if (entrega.submissaoTipo === "EXCECAO") {
    return `<i class="ph ph-warning-circle" style="color: #ca8a04;" title="Exceção (sem ficheiro): ${escapeHtml(entrega.submissaoNota || "")}"></i>`;
  }
  return `<i class="ph ph-user-check" title="Confirmado pela coordenação"></i>`;
}

async function carregarDashboard() {
  if (!tbodyDashboard) return;

  try {
    const entregas = await api("/entregas");
    tbodyDashboard.innerHTML = "";

    if (entregas.length === 0) {
      tbodyDashboard.innerHTML = '<tr class="linha-vazia"><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma entrega registada.</td></tr>';
      atualizarContadoresFiltro({ critico: 0, hoje: 0, pendente: 0, todos: 0 });
      return;
    }

    const contadores = { critico: 0, hoje: 0, pendente: 0, todos: 0 };

    entregas.forEach((entrega) => {
      const diasRestantes = calcularDias(entrega.dataLimite);
      let textoPrazo = "";
      let corPrazo = "";
      let estado = "";
      let badgeHTML = "";

      if (entrega.entregue) {
        textoPrazo = "—";
        corPrazo = "#64748b";
        estado = "entregue";
        badgeHTML = '<span class="badge green">Entregue</span>';
      } else if (diasRestantes < 0) {
        textoPrazo = diasRestantes === -1 ? "Ontem" : `Há ${Math.abs(diasRestantes)} dias`;
        corPrazo = "#dc2626";
        estado = "critico";
        badgeHTML = '<span class="badge red">Em Falta</span>';
        contadores.critico++;
      } else if (diasRestantes === 0) {
        textoPrazo = "Hoje";
        corPrazo = "#ca8a04";
        estado = "hoje";
        badgeHTML = '<span class="badge yellow">Hoje</span>';
        contadores.hoje++;
      } else {
        textoPrazo = `Daqui a ${diasRestantes} dias`;
        corPrazo = "#2563eb";
        estado = "pendente";
        badgeHTML = '<span class="badge blue">Pendente</span>';
        contadores.pendente++;
      }
      contadores.todos++;

      const dataFormatada = new Date(entrega.dataLimite).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
      const iniciais = (entrega.formador.sigla || entrega.formador.nome.slice(0, 2)).toUpperCase();

      const btnEntregue = entrega.entregue
        ? ""
        : `<button class="btn-icon btn-entregue" data-id="${entrega.id}" title="Marcar como Entregue"><i class="ph ph-check-circle"></i></button>`;

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", estado);
      tr.innerHTML = `
                <td><div class="avatar-circle">${escapeHtml(iniciais)}</div> ${escapeHtml(entrega.formador.nome)}</td>
                <td>${escapeHtml(entrega.turma.codigo)}</td>
                <td>${escapeHtml(entrega.documento)} ${indicadorSubmissao(entrega)}</td>
                <td style="color: ${corPrazo}; font-weight: 500;">${textoPrazo}</td>
                <td><strong>${dataFormatada}</strong></td>
                <td>${badgeHTML}</td>
                <td>
                    ${btnEntregue}
                    <button class="btn-icon btn-editar-aviso"
                        data-id="${entrega.id}"
                        data-formador-id="${entrega.formadorId}"
                        data-turma-id="${entrega.turmaId}"
                        data-documento="${escapeHtml(entrega.documento)}"
                        data-prazo="${entrega.dataLimite.slice(0, 10)}"
                        title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon btn-apagar-aviso" data-id="${entrega.id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
      tbodyDashboard.appendChild(tr);
    });

    tbodyDashboard.querySelectorAll(".link-ficheiro").forEach((link) => {
      link.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await abrirFicheiroProtegido(`/entregas/${link.getAttribute("data-id")}/ficheiro`);
        } catch (error) {
          showToast(error.message || "Não foi possível abrir o ficheiro.", "error");
        }
      });
    });

    tbodyDashboard.querySelectorAll(".btn-entregue").forEach((botao) => {
      botao.addEventListener("click", async () => {
        try {
          await api(`/entregas/${botao.getAttribute("data-id")}/marcar-entregue`, { method: "PATCH" });
          showToast("Marcado como entregue!", "success");
          carregarDashboard();
        } catch (error) {
          showToast(error.message || "Erro ao atualizar.", "error");
        }
      });
    });

    tbodyDashboard.querySelectorAll(".btn-apagar-aviso").forEach((botao) => {
      botao.addEventListener("click", async () => {
        if (confirm("Tens a certeza que queres desativar este aviso? O histórico de submissões mantém-se.")) {
          try {
            await api(`/entregas/${botao.getAttribute("data-id")}`, { method: "DELETE" });
            showToast("Aviso desativado com sucesso!", "success");
            carregarDashboard();
          } catch (error) {
            showToast(error.message || "Erro ao desativar.", "error");
          }
        }
      });
    });

    tbodyDashboard.querySelectorAll(".btn-editar-aviso").forEach((botao) => {
      botao.addEventListener("click", async () => {
        idAvisoEmEdicao = botao.getAttribute("data-id");
        await carregarOpcoesFormularioAviso();
        selectFormador.value = botao.getAttribute("data-formador-id");
        selectTurma.value = botao.getAttribute("data-turma-id");
        document.getElementById("aviso-documento").value = botao.getAttribute("data-documento");
        document.getElementById("aviso-prazo").value = botao.getAttribute("data-prazo");

        if (modalTituloAviso) modalTituloAviso.textContent = "Editar Aviso";
        if (modalAviso) modalAviso.style.display = "flex";
      });
    });

    atualizarContadoresFiltro(contadores);
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
    showToast(error.message || "Erro ao carregar dashboard.", "error");
  }
}

function atualizarContadoresFiltro(contadores) {
  if (filtroPrazos && filtroPrazos.options.length >= 4) {
    filtroPrazos.options[0].text = `${contadores.critico} CRÍTICOS`;
    filtroPrazos.options[1].text = `${contadores.hoje} HOJE`;
    filtroPrazos.options[2].text = `${contadores.pendente} PENDENTES`;
    filtroPrazos.options[3].text = `TODOS (${contadores.todos})`;
  }
}

if (filtroPrazos) {
  filtroPrazos.addEventListener("change", function () {
    const linhas = document.querySelectorAll("#tabela-dashboard tbody tr");
    const cores = { critico: "red", hoje: "yellow", pendente: "blue", todos: "gray" };
    this.className = `badge ${cores[this.value] || "gray"}`;

    linhas.forEach((l) => {
      if (l.classList.contains("linha-vazia")) return;
      l.style.display = this.value === "todos" || l.getAttribute("data-estado") === this.value ? "" : "none";
    });
  });
}

if (btnNovoAviso) btnNovoAviso.addEventListener("click", abrirModalAviso);
if (fecharModalAviso) fecharModalAviso.addEventListener("click", fecharModal);

if (formNovoAviso) {
  formNovoAviso.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      formadorId: selectFormador.value,
      turmaId: selectTurma.value,
      documento: document.getElementById("aviso-documento").value,
      dataLimite: document.getElementById("aviso-prazo").value,
    };

    try {
      if (idAvisoEmEdicao) {
        await api(`/entregas/${idAvisoEmEdicao}`, { method: "PATCH", body: dados });
        showToast("Aviso atualizado com sucesso!", "success");
      } else {
        await api("/entregas", { method: "POST", body: dados });
        showToast("Falta registada com sucesso!", "success");
      }

      formNovoAviso.reset();
      fecharModal();
      carregarDashboard();
    } catch (error) {
      console.error("Erro ao guardar aviso:", error);
      showToast(error.message || "Ocorreu um erro ao guardar.", "error");
    }
  });
}

carregarDashboard();
