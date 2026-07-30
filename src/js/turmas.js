import { api } from "./api-client.js";
import { showToast } from "./toast.js";

const formNovaTurma = document.getElementById("form-nova-turma");
const tbodyTurmas = document.querySelector("#tabela-turmas tbody");
const modalTurma = document.getElementById("modal-turma");
const modalTitulo = document.querySelector("#modal-turma h3");
let idTurmaEmEdicao = null;

const btnNovaTurma = document.getElementById("btn-nova-turma");
if (btnNovaTurma) {
  btnNovaTurma.addEventListener("click", () => {
    idTurmaEmEdicao = null;
    formNovaTurma.reset();
    modalTitulo.textContent = "Criar Nova Turma";
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
    const turmas = await api("/turmas");
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
      tr.setAttribute("data-estado", turma.estado);

      tr.innerHTML = `
                <td><strong>${turma.codigo}</strong></td>
                <td>${turma.designacao}</td>
                <td>${dataInicioISO}</td>
                <td>${turma.numFormandos}</td>
                <td><span class="badge ${cor}">${texto}</span></td>
                <td>
                    <button class="btn-icon btn-editar"
                        data-id="${turma.id}"
                        data-codigo="${turma.codigo}"
                        data-designacao="${turma.designacao}"
                        data-data="${dataInicioISO}"
                        data-alunos="${turma.numFormandos}"
                        data-estado="${turma.estado}"
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${turma.id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
      tbodyTurmas.appendChild(tr);
    });

    document.querySelectorAll(".btn-apagar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idTurma = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres apagar esta turma permanentemente?")) {
          try {
            await api(`/turmas/${idTurma}`, { method: "DELETE" });
            showToast("Turma apagada com sucesso!", "success");
            carregarTurmas();
          } catch (error) {
            showToast(error.message || "Erro ao apagar.", "error");
          }
        }
      });
    });

    document.querySelectorAll(".btn-editar").forEach((botao) => {
      botao.addEventListener("click", () => {
        idTurmaEmEdicao = botao.getAttribute("data-id");
        document.getElementById("new-codigo").value = botao.getAttribute("data-codigo");
        document.getElementById("new-designacao").value = botao.getAttribute("data-designacao");
        document.getElementById("new-data").value = botao.getAttribute("data-data");
        document.getElementById("new-alunos").value = botao.getAttribute("data-alunos");
        document.getElementById("new-estado").value = botao.getAttribute("data-estado");

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

if (formNovaTurma) {
  formNovaTurma.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      codigo: document.getElementById("new-codigo").value,
      designacao: document.getElementById("new-designacao").value,
      dataInicio: document.getElementById("new-data").value,
      numFormandos: document.getElementById("new-alunos").value,
      estado: document.getElementById("new-estado").value,
    };

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

const inputPesquisa = document.getElementById("pesquisa-turmas");
if (inputPesquisa) {
  inputPesquisa.addEventListener("keyup", function () {
    const termoPesquisa = this.value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-turmas tbody tr");

    linhasTabela.forEach((linha) => {
      if (linha.classList.contains("linha-vazia")) return;
      const textoDaLinha = linha.textContent.toLowerCase();
      linha.style.display = textoDaLinha.includes(termoPesquisa) ? "" : "none";
    });
  });
}
