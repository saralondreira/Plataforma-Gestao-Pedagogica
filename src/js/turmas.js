import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { ligarFiltros } from "./filtroTabela.js";

const formNovaTurma = document.getElementById("form-nova-turma");
const tbodyTurmas = document.querySelector("#tabela-turmas tbody");
const modalTurma = document.getElementById("modal-turma");
const modalTitulo = document.querySelector("#modal-turma h3");
const selectMediador = document.getElementById("new-mediador");
const checkboxDesativadas = document.getElementById("mostrar-turmas-desativadas");
let idTurmaEmEdicao = null;
// Se a lista de formadores não carregou, o select fica vazio: nesse caso o pedido
// não envia mediadorId, para não remover sem querer o mediador já atribuído.
let mediadoresCarregados = false;


async function carregarMediadoresNoSelect(valorSelecionado) {
  if (!selectMediador) return;
  mediadoresCarregados = false;
  try {
    const formadores = await api("/formadores");
    selectMediador.innerHTML = '<option value="">— Sem mediador —</option>';
    formadores.forEach((formador) => {
      const opt = document.createElement("option");
      opt.value = formador.id;
      opt.textContent = formador.nome;
      selectMediador.appendChild(opt);
    });
    selectMediador.value = valorSelecionado || "";
    mediadoresCarregados = true;
  } catch (error) {
    console.error("Erro ao carregar formadores para mediador:", error);
  }
}

const btnNovaTurma = document.getElementById("btn-nova-turma");
if (btnNovaTurma) {
  btnNovaTurma.addEventListener("click", async () => {
    idTurmaEmEdicao = null;
    formNovaTurma.reset();
    modalTitulo.textContent = "Criar Nova Turma";
    await carregarMediadoresNoSelect();
    modalTurma.style.display = "flex";
  });
}

const btnFecharModal = document.getElementById("fechar-modal");
if (btnFecharModal) {
  btnFecharModal.addEventListener("click", () => {
    modalTurma.style.display = "none";
  });
}

function estadoParaBadge(estado) {
  if (estado === "EM_CURSO") return { cor: "blue", texto: "EM CURSO" };
  if (estado === "CONCLUIDA") return { cor: "gray", texto: "CONCLUÍDA" };
  return { cor: "yellow", texto: "PLANEADA" };
}

async function carregarTurmas() {
  if (!tbodyTurmas) return;

  try {
    const incluirInativos = checkboxDesativadas ? checkboxDesativadas.checked : false;
    const turmas = await api(`/turmas${incluirInativos ? "?incluirInativos=true" : ""}`);
    tbodyTurmas.innerHTML = "";

    if (turmas.length === 0) {
      tbodyTurmas.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma turma encontrada.</td></tr>';
      return;
    }

    turmas.forEach((turma) => {
      const { cor, texto } = estadoParaBadge(turma.estado);
      const dataInicioISO = turma.dataInicio.slice(0, 10);

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", String(turma.estado).toLowerCase().replace(/_/g, "-"));
      const desativada = turma.ativo === false;
      if (desativada) tr.style.opacity = "0.55";

      const acoes = desativada
        ? `<button class="btn-icon btn-reativar" data-id="${turma.id}" title="Reativar"><i class="ph ph-arrow-counter-clockwise"></i></button>`
        : `<button class="btn-icon btn-ucs"
                        data-id="${turma.id}"
                        data-codigo="${escapeHtml(turma.codigo)}"
                        data-designacao="${escapeHtml(turma.designacao)}"
                        title="Gerir UCs desta turma"><i class="ph ph-books"></i>
                    </button>
                    <button class="btn-icon btn-editar"
                        data-id="${turma.id}"
                        data-codigo="${escapeHtml(turma.codigo)}"
                        data-designacao="${escapeHtml(turma.designacao)}"
                        data-data="${dataInicioISO}"
                        data-alunos="${turma.numFormandos}"
                        data-estado="${turma.estado}"
                        data-id-curso-iefp="${escapeHtml(turma.idCursoIEFP || "")}"
                        data-mediador-id="${turma.mediadorId || ""}"
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${turma.id}" title="Desativar"><i class="ph ph-trash"></i></button>`;

      tr.innerHTML = `
                <td><strong>${escapeHtml(turma.codigo)}</strong></td>
                <td>${escapeHtml(turma.designacao)}${desativada ? ' <span class="badge red" style="margin-left: 6px;">DESATIVADA</span>' : ""}</td>
                <td>${dataInicioISO}</td>
                <td>${turma.numFormandos}</td>
                <td><span class="badge ${cor}">${texto}</span></td>
                <td>${acoes}</td>
            `;
      tbodyTurmas.appendChild(tr);
    });
    atualizarFiltro();

    document.querySelectorAll(".btn-apagar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idTurma = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres desativar esta turma? As entregas e UCs associadas mantêm-se e podes reativá-la mais tarde.")) {
          try {
            await api(`/turmas/${idTurma}`, { method: "DELETE" });
            showToast("Turma desativada com sucesso!", "success");
            carregarTurmas();
          } catch (error) {
            showToast(error.message || "Erro ao desativar.", "error");
          }
        }
      });
    });

    document.querySelectorAll(".btn-reativar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idTurma = botao.getAttribute("data-id");
        try {
          await api(`/turmas/${idTurma}/reativar`, { method: "PATCH" });
          showToast("Turma reativada com sucesso!", "success");
          carregarTurmas();
        } catch (error) {
          showToast(error.message || "Erro ao reativar.", "error");
        }
      });
    });

    document.querySelectorAll(".btn-ucs").forEach((botao) => {
      botao.addEventListener("click", () => {
        window.location.href = `turmaUcs.html?turmaId=${botao.getAttribute("data-id")}`;
      });
    });

    document.querySelectorAll(".btn-editar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        idTurmaEmEdicao = botao.getAttribute("data-id");
        document.getElementById("new-codigo").value = botao.getAttribute("data-codigo");
        document.getElementById("new-designacao").value = botao.getAttribute("data-designacao");
        document.getElementById("new-data").value = botao.getAttribute("data-data");
        document.getElementById("new-alunos").value = botao.getAttribute("data-alunos");
        document.getElementById("new-estado").value = botao.getAttribute("data-estado");
        document.getElementById("new-id-curso-iefp").value = botao.getAttribute("data-id-curso-iefp") || "";
        await carregarMediadoresNoSelect(botao.getAttribute("data-mediador-id"));

        modalTitulo.textContent = "Editar Turma";
        modalTurma.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Erro ao carregar turmas:", error);
    showToast(error.message || "Erro ao carregar turmas.", "error");
  }
}

carregarTurmas();

if (checkboxDesativadas) {
  checkboxDesativadas.addEventListener("change", carregarTurmas);
}

if (formNovaTurma) {
  formNovaTurma.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      codigo: document.getElementById("new-codigo").value,
      designacao: document.getElementById("new-designacao").value,
      dataInicio: document.getElementById("new-data").value,
      numFormandos: document.getElementById("new-alunos").value,
      estado: document.getElementById("new-estado").value,
      idCursoIEFP: document.getElementById("new-id-curso-iefp").value || undefined,
    };
    if (mediadoresCarregados) dados.mediadorId = selectMediador.value ? Number(selectMediador.value) : null;

    try {
      if (idTurmaEmEdicao) {
        await api(`/turmas/${idTurmaEmEdicao}`, { method: "PATCH", body: dados });
        showToast("Turma atualizada com sucesso!", "success");
      } else {
        await api("/turmas", { method: "POST", body: dados });
        showToast("Nova turma criada com sucesso!", "success");
      }

      formNovaTurma.reset();
      modalTurma.style.display = "none";
      idTurmaEmEdicao = null;
      carregarTurmas();
    } catch (error) {
      console.error("Erro ao guardar turma: ", error);
      showToast(error.message || "Ocorreu um erro ao guardar os dados.", "error");
    }
  });
}

const atualizarFiltro = ligarFiltros({
  tabelaId: "tabela-turmas",
  selectId: "filtro-turmas",
  pesquisaId: "pesquisa-turmas",
  rotulos: { "em-curso": "EM CURSO", planeada: "PLANEADAS", concluida: "CONCLUÍDAS", todas: "TODOS" },
  cores: { "em-curso": "blue", planeada: "yellow", concluida: "green", todas: "gray" },
  todos: "todas",
});
