import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { ligarFiltros } from "./filtroTabela.js";

const formNovoFormador = document.getElementById("form-novo-formador");
const tbodyFormadores = document.querySelector("#tabela-formadores tbody");
const modalFormador = document.getElementById("modal-formador");
const modalTitulo = document.getElementById("modal-titulo-formador");
const btnNovoFormador = document.getElementById("btn-novo-formador");
const btnFecharModal = document.getElementById("fechar-modal-formador");
const grupoCredenciais = document.getElementById("grupo-credenciais-formador");
const emailInput = document.getElementById("new-email-formador");
const passwordInput = document.getElementById("new-password-formador");
const checkboxDesativados = document.getElementById("mostrar-formadores-desativados");

let idFormadorEmEdicao = null;

if (btnFecharModal) {
  btnFecharModal.addEventListener("click", () => {
    modalFormador.style.display = "none";
  });
}

if (btnNovoFormador) {
  btnNovoFormador.addEventListener("click", () => {
    idFormadorEmEdicao = null;
    formNovoFormador.reset();
    modalTitulo.textContent = "Adicionar Formador";
    if (grupoCredenciais) grupoCredenciais.style.display = "grid";
    if (emailInput) emailInput.required = true;
    if (passwordInput) passwordInput.required = true;
    modalFormador.style.display = "flex";
  });
}

async function carregarFormadores() {
  if (!tbodyFormadores) return;

  try {
    const incluirInativos = checkboxDesativados ? checkboxDesativados.checked : false;
    const formadores = await api(`/formadores${incluirInativos ? "?incluirInativos=true" : ""}`);
    tbodyFormadores.innerHTML = "";

    if (formadores.length === 0) {
      tbodyFormadores.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhum formador registado.</td></tr>';
      return;
    }

    formadores.forEach((formador) => {
      const estadoTexto = formador.estadoFormador || "ATIVO";
      const cor = estadoTexto === "ATIVO" ? "green" : "red";
      const desativado = formador.ativo === false;

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", estadoTexto.toLowerCase());
      if (desativado) {
        tr.style.opacity = "0.55";
      }

      const acoes = desativado
        ? `<button class="btn-icon btn-reativar" data-id="${formador.id}" title="Reativar"><i class="ph ph-arrow-counter-clockwise"></i></button>`
        : `<button class="btn-icon btn-editar"
                        data-id="${formador.id}"
                        data-sigla="${escapeHtml(formador.sigla || "")}"
                        data-nome="${escapeHtml(formador.nome)}"
                        data-turmas="${formador.turmasQtd ?? 0}"
                        data-ucs="${formador.ucsQtd ?? 0}"
                        data-estado="${estadoTexto}"
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${formador.id}" title="Desativar"><i class="ph ph-trash"></i></button>`;

      tr.innerHTML = `
                <td><div class="avatar-circle">${escapeHtml(formador.sigla || "")}</div> <strong>${escapeHtml(formador.nome)}</strong></td>
                <td>${escapeHtml(formador.nome)}${desativado ? ' <span class="badge red" style="margin-left: 6px;">DESATIVADO</span>' : ""}</td>
                <td style="text-align: center;">${formador.turmasQtd ?? 0}</td>
                <td style="text-align: center;">${formador.ucsQtd ?? 0}</td>
                <td><span class="badge ${cor}">${estadoTexto}</span></td>
                <td>${acoes}</td>
            `;
      tbodyFormadores.appendChild(tr);
    });
    atualizarFiltro();

    document.querySelectorAll(".btn-apagar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idFormador = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres desativar este formador? A conta deixa de poder fazer login, mas o histórico mantém-se e podes reativá-la mais tarde.")) {
          try {
            await api(`/formadores/${idFormador}`, { method: "DELETE" });
            showToast("Formador desativado com sucesso!", "success");
            carregarFormadores();
          } catch (error) {
            showToast(error.message || "Erro ao desativar formador.", "error");
          }
        }
      });
    });

    document.querySelectorAll(".btn-reativar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idFormador = botao.getAttribute("data-id");
        try {
          await api(`/formadores/${idFormador}/reativar`, { method: "PATCH" });
          showToast("Formador reativado com sucesso!", "success");
          carregarFormadores();
        } catch (error) {
          showToast(error.message || "Erro ao reativar formador.", "error");
        }
      });
    });

    document.querySelectorAll(".btn-editar").forEach((botao) => {
      botao.addEventListener("click", () => {
        idFormadorEmEdicao = botao.getAttribute("data-id");
        document.getElementById("new-sigla").value = botao.getAttribute("data-sigla");
        document.getElementById("new-nome").value = botao.getAttribute("data-nome");
        document.getElementById("new-turmas-qtd").value = botao.getAttribute("data-turmas");
        document.getElementById("new-ucs-qtd").value = botao.getAttribute("data-ucs");
        document.getElementById("new-estado-formador").value = botao.getAttribute("data-estado");

        modalTitulo.textContent = "Editar Formador";
        // Email/password só se aplicam à criação da conta — não são editáveis aqui.
        if (grupoCredenciais) grupoCredenciais.style.display = "none";
        if (emailInput) emailInput.required = false;
        if (passwordInput) passwordInput.required = false;
        modalFormador.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Erro ao carregar formadores:", error);
    showToast(error.message || "Erro ao carregar formadores.", "error");
  }
}

carregarFormadores();

if (checkboxDesativados) {
  checkboxDesativados.addEventListener("change", carregarFormadores);
}

if (formNovoFormador) {
  formNovoFormador.addEventListener("submit", async (e) => {
    e.preventDefault();

    const sigla = document.getElementById("new-sigla").value;
    const nome = document.getElementById("new-nome").value;
    const turmasQtd = document.getElementById("new-turmas-qtd").value;
    const ucsQtd = document.getElementById("new-ucs-qtd").value;
    const estadoFormador = document.getElementById("new-estado-formador").value.toUpperCase();

    try {
      if (idFormadorEmEdicao) {
        await api(`/formadores/${idFormadorEmEdicao}`, {
          method: "PATCH",
          body: { sigla, nome, turmasQtd, ucsQtd, estadoFormador },
        });
        showToast("Formador atualizado com sucesso!", "success");
      } else {
        await api("/formadores", {
          method: "POST",
          body: {
            sigla,
            nome,
            turmasQtd,
            ucsQtd,
            estadoFormador,
            email: emailInput.value,
            password: passwordInput.value,
          },
        });
        showToast("Novo formador adicionado com sucesso!", "success");
      }

      formNovoFormador.reset();
      modalFormador.style.display = "none";
      idFormadorEmEdicao = null;
      carregarFormadores();
    } catch (error) {
      console.error("Erro ao guardar formador: ", error);
      showToast(error.message || "Ocorreu um erro ao guardar os dados.", "error");
    }
  });
}

const atualizarFiltro = ligarFiltros({
  tabelaId: "tabela-formadores",
  selectId: "filtro-formadores",
  pesquisaId: "pesquisa-formadores",
  rotulos: { ativo: "ATIVO", inativo: "INATIVO", todos: "TODOS" },
  cores: { ativo: "green", inativo: "red", todos: "gray" },
  todos: "todos",
});
