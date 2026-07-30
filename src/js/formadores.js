import { api } from "./api-client.js";
import { showToast } from "./toast.js";

const formNovoFormador = document.getElementById("form-novo-formador");
const tbodyFormadores = document.querySelector("#tabela-formadores tbody");
const modalFormador = document.getElementById("modal-formador");
const modalTitulo = document.getElementById("modal-titulo-formador");
const btnNovoFormador = document.getElementById("btn-novo-formador");
const btnFecharModal = document.getElementById("fechar-modal-formador");
const grupoCredenciais = document.getElementById("grupo-credenciais-formador");
const emailInput = document.getElementById("new-email-formador");
const passwordInput = document.getElementById("new-password-formador");

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
    const formadores = await api("/formadores");
    tbodyFormadores.innerHTML = "";

    if (formadores.length === 0) {
      tbodyFormadores.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhum formador registado.</td></tr>';
      return;
    }

    formadores.forEach((formador) => {
      const cor = formador.estadoFormador === "ATIVO" ? "green" : "red";
      const estadoTexto = formador.estadoFormador || "ATIVO";

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", estadoTexto.toLowerCase());

      tr.innerHTML = `
                <td><div class="avatar-circle">${formador.sigla || ""}</div> <strong>${formador.nome}</strong></td>
                <td>${formador.nome}</td>
                <td style="text-align: center;">${formador.turmasQtd ?? 0}</td>
                <td style="text-align: center;">${formador.ucsQtd ?? 0}</td>
                <td><span class="badge ${cor}">${estadoTexto}</span></td>
                <td>
                    <button class="btn-icon btn-editar"
                        data-id="${formador.id}"
                        data-sigla="${formador.sigla || ""}"
                        data-nome="${formador.nome}"
                        data-turmas="${formador.turmasQtd ?? 0}"
                        data-ucs="${formador.ucsQtd ?? 0}"
                        data-estado="${estadoTexto}"
                        title="Editar"><i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="btn-icon btn-apagar" data-id="${formador.id}" title="Apagar"><i class="ph ph-trash"></i></button>
                </td>
            `;
      tbodyFormadores.appendChild(tr);
    });

    document.querySelectorAll(".btn-apagar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const idFormador = botao.getAttribute("data-id");
        if (confirm("Tens a certeza que queres apagar este formador?")) {
          try {
            await api(`/formadores/${idFormador}`, { method: "DELETE" });
            showToast("Formador apagado com sucesso!", "success");
            carregarFormadores();
          } catch (error) {
            showToast(error.message || "Erro ao apagar formador.", "error");
          }
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

const inputPesquisaFormadores = document.getElementById("pesquisa-formadores");
if (inputPesquisaFormadores) {
  inputPesquisaFormadores.addEventListener("keyup", function () {
    const termoPesquisa = this.value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-formadores tbody tr");

    linhasTabela.forEach((linha) => {
      if (linha.classList.contains("linha-vazia")) return;
      const textoDaLinha = linha.textContent.toLowerCase();
      linha.style.display = textoDaLinha.includes(termoPesquisa) ? "" : "none";
    });
  });
}
