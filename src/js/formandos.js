import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tbodyFormandos = document.querySelector("#tabela-formandos tbody");
const checkboxDesativados = document.getElementById("mostrar-formandos-desativados");
const inputPesquisa = document.getElementById("pesquisa-formandos");

const modalTurma = document.getElementById("modal-turma-formando");
const fecharModalTurma = document.getElementById("fechar-modal-turma-formando");
const formTurma = document.getElementById("form-turma-formando");
const nomeFormandoTexto = document.getElementById("turma-formando-nome");
const selectTurmaFormando = document.getElementById("turma-formando-select");

let idFormandoEmEdicao = null;
let turmasCarregadas = false;

let pedidoFormandos = 0;

async function carregarFormandos() {
  if (!tbodyFormandos) return;
  const pedido = ++pedidoFormandos; // ignora respostas de um filtro entretanto trocado

  try {
    const incluirInativos = checkboxDesativados ? checkboxDesativados.checked : false;
    const formandos = await api(`/formandos${incluirInativos ? "?incluirInativos=true" : ""}`);
    if (pedido !== pedidoFormandos) return;
    tbodyFormandos.innerHTML = "";

    if (formandos.length === 0) {
      tbodyFormandos.innerHTML =
        '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Nenhum formando registado.</td></tr>';
      return;
    }

    formandos.forEach((formando) => {
      const desativado = formando.ativo === false;
      const turmaTexto = formando.turma
        ? `${escapeHtml(formando.turma.codigo)} — ${escapeHtml(formando.turma.designacao)}`
        : '<span style="color: #94a3b8;">— Sem turma —</span>';
      const estadoBadge = desativado
        ? '<span class="badge red">DESATIVADO</span>'
        : '<span class="badge green">ATIVO</span>';

      const tr = document.createElement("tr");
      if (desativado) tr.style.opacity = "0.55";

      tr.innerHTML = `
                <td><strong>${escapeHtml(formando.nome)}</strong></td>
                <td>${escapeHtml(formando.email)}</td>
                <td>${turmaTexto}</td>
                <td>${estadoBadge}</td>
                <td>
                  <button class="btn-icon btn-mudar-turma"
                    data-id="${formando.id}"
                    data-nome="${escapeHtml(formando.nome)}"
                    data-turma-id="${formando.turma ? formando.turma.id : ""}"
                    title="Mudar turma"><i class="ph ph-arrows-left-right"></i></button>
                </td>
            `;
      tbodyFormandos.appendChild(tr);
    });

    tbodyFormandos.querySelectorAll(".btn-mudar-turma").forEach((botao) => {
      botao.addEventListener("click", async () => {
        idFormandoEmEdicao = botao.getAttribute("data-id");
        if (nomeFormandoTexto) {
          nomeFormandoTexto.textContent = `A mudar a turma de ${botao.getAttribute("data-nome")}.`;
        }

        if (!turmasCarregadas) await carregarTurmas();
        // Sem a lista de turmas o select só teria "Sem turma": gravar assim retirava a turma ao formando.
        if (!turmasCarregadas) {
          idFormandoEmEdicao = null;
          return;
        }
        // Só abre o modal para o formando em que se clicou por último.
        if (idFormandoEmEdicao !== botao.getAttribute("data-id")) return;
        if (selectTurmaFormando) {
          selectTurmaFormando.value = botao.getAttribute("data-turma-id") || "";
        }

        if (modalTurma) modalTurma.style.display = "flex";
      });
    });
  } catch (error) {
    console.error("Erro ao carregar formandos:", error);
    showToast(error.message || "Erro ao carregar formandos.", "error");
  }
}

async function carregarTurmas() {
  if (!selectTurmaFormando) return;
  try {
    const turmas = await api("/turmas");
    selectTurmaFormando.innerHTML = '<option value="">— Sem turma —</option>';
    turmas
      .filter((turma) => turma.ativo !== false)
      .forEach((turma) => {
        const opt = document.createElement("option");
        opt.value = turma.id;
        opt.textContent = `${turma.codigo} — ${turma.designacao}`;
        selectTurmaFormando.appendChild(opt);
      });
    turmasCarregadas = true;
  } catch (error) {
    console.error("Erro ao carregar turmas:", error);
    showToast(error.message || "Erro ao carregar turmas.", "error");
  }
}

carregarFormandos();

if (checkboxDesativados) {
  checkboxDesativados.addEventListener("change", carregarFormandos);
}

if (fecharModalTurma) {
  fecharModalTurma.addEventListener("click", () => {
    modalTurma.style.display = "none";
    idFormandoEmEdicao = null;
  });
}

if (formTurma) {
  formTurma.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!idFormandoEmEdicao) return;

    try {
      const turmaId = selectTurmaFormando.value ? Number(selectTurmaFormando.value) : null;
      await api(`/formandos/${idFormandoEmEdicao}/turma`, {
        method: "PATCH",
        body: { turmaId },
      });

      if (modalTurma) modalTurma.style.display = "none";
      idFormandoEmEdicao = null;
      showToast("Turma atualizada com sucesso!", "success");
      carregarFormandos();
    } catch (error) {
      console.error("Erro ao mudar a turma do formando:", error);
      showToast(error.message || "Erro ao mudar a turma.", "error");
    }
  });
}

if (inputPesquisa) {
  inputPesquisa.addEventListener("keyup", function () {
    const termoPesquisa = this.value.toLowerCase();
    const linhasTabela = document.querySelectorAll("#tabela-formandos tbody tr");

    linhasTabela.forEach((linha) => {
      if (linha.classList.contains("linha-vazia")) return;
      const textoDaLinha = linha.textContent.toLowerCase();
      linha.style.display = textoDaLinha.includes(termoPesquisa) ? "" : "none";
    });
  });
}
