import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tbody = document.querySelector("#tabela-pedidos tbody");

const modalAprovar = document.getElementById("modal-aprovar");
const fecharModalAprovar = document.getElementById("fechar-modal-aprovar");
const formAprovar = document.getElementById("form-aprovar");
const selectRole = document.getElementById("aprovar-role");
const grupoTurma = document.getElementById("aprovar-turma-group");
const selectTurma = document.getElementById("aprovar-turma");

const modalCredenciais = document.getElementById("modal-credenciais");
const fecharModalCredenciais = document.getElementById("fechar-modal-credenciais");
const credEmailInput = document.getElementById("cred-email");
const credMensagem = document.getElementById("cred-mensagem");

let idPedidoAtual = null;

function badgeEstado(estado) {
  if (estado === "APROVADO") return '<span class="badge green">APROVADO</span>';
  if (estado === "REJEITADO") return '<span class="badge red">REJEITADO</span>';
  if (estado === "A_AGUARDAR_RH") return '<span class="badge blue">A AGUARDAR RH</span>';
  return '<span class="badge yellow">PENDENTE</span>';
}

async function carregarPedidos() {
  if (!tbody) return;

  try {
    const pedidos = await api("/pedidos-acesso");
    tbody.innerHTML = "";

    if (pedidos.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Nenhum pedido de acesso.</td></tr>';
      return;
    }

    pedidos.forEach((pedido) => {
      let acoes = "—";
      if (pedido.estado === "PENDENTE") {
        acoes = `<button class="btn-icon btn-aprovar" data-id="${pedido.id}" title="Aprovar"><i class="ph ph-check-circle"></i></button>
             <button class="btn-icon btn-rejeitar" data-id="${pedido.id}" title="Rejeitar"><i class="ph ph-x-circle"></i></button>`;
      } else if (pedido.estado === "A_AGUARDAR_RH") {
        acoes = `<button class="btn-icon btn-confirmar-conta" data-id="${pedido.id}" title="Confirmar que os RH já criaram a conta"><i class="ph ph-user-check"></i></button>
             <button class="btn-icon btn-rejeitar" data-id="${pedido.id}" title="Rejeitar"><i class="ph ph-x-circle"></i></button>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${escapeHtml(pedido.nome)}</td>
                <td>${escapeHtml(pedido.email)}</td>
                <td>${escapeHtml(pedido.cargo)}</td>
                <td>${pedido.motivo ? escapeHtml(pedido.motivo) : "—"}</td>
                <td>${badgeEstado(pedido.estado)}</td>
                <td>${acoes}</td>
            `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-aprovar").forEach((botao) => {
      botao.addEventListener("click", () => {
        idPedidoAtual = botao.getAttribute("data-id");
        if (formAprovar) formAprovar.reset();
        atualizarVisibilidadeTurma();
        if (modalAprovar) modalAprovar.style.display = "flex";
      });
    });

    tbody.querySelectorAll(".btn-confirmar-conta").forEach((botao) => {
      botao.addEventListener("click", async () => {
        if (!confirm("Confirmas que os RH já criaram esta conta? Isto cria a conta cá na plataforma e envia as credenciais por email à pessoa."))
          return;

        try {
          const resultado = await api(`/pedidos-acesso/${botao.getAttribute("data-id")}/confirmar-conta-criada`, {
            method: "PATCH",
          });
          mostrarModalCredenciais(resultado);
        } catch (error) {
          showToast(error.message || "Erro ao confirmar a criação da conta.", "error");
        }
      });
    });

    tbody.querySelectorAll(".btn-rejeitar").forEach((botao) => {
      botao.addEventListener("click", async () => {
        if (!confirm("Tens a certeza que queres rejeitar este pedido?")) return;

        try {
          await api(`/pedidos-acesso/${botao.getAttribute("data-id")}/rejeitar`, { method: "PATCH" });
          showToast("Pedido rejeitado.", "success");
          carregarPedidos();
        } catch (error) {
          showToast(error.message || "Erro ao rejeitar o pedido.", "error");
        }
      });
    });
  } catch (error) {
    console.error("Erro ao carregar pedidos de acesso:", error);
    showToast(error.message || "Erro ao carregar pedidos de acesso.", "error");
  }
}

carregarPedidos();
carregarTurmasParaAprovar();

function atualizarVisibilidadeTurma() {
  if (!grupoTurma || !selectRole) return;
  grupoTurma.style.display = selectRole.value === "FORMANDO" ? "" : "none";
}

async function carregarTurmasParaAprovar() {
  if (!selectTurma) return;
  try {
    const turmas = await api("/turmas");
    selectTurma.innerHTML = '<option value="">— Sem turma por agora —</option>';
    turmas
      .filter((turma) => turma.ativo !== false)
      .forEach((turma) => {
        const opt = document.createElement("option");
        opt.value = turma.id;
        opt.textContent = `${turma.codigo} — ${turma.designacao}`;
        selectTurma.appendChild(opt);
      });
  } catch (error) {
    console.error("Erro ao carregar turmas para associar ao formando:", error);
  }
}

if (selectRole) {
  selectRole.addEventListener("change", atualizarVisibilidadeTurma);
}

if (fecharModalAprovar) {
  fecharModalAprovar.addEventListener("click", () => {
    modalAprovar.style.display = "none";
    idPedidoAtual = null;
  });
}

if (fecharModalCredenciais) {
  fecharModalCredenciais.addEventListener("click", () => {
    modalCredenciais.style.display = "none";
    carregarPedidos();
  });
}

// Mostra o modal de "conta criada" depois de PATCH /confirmar-conta-criada
// (o único passo que, no fluxo via RH, chega a criar mesmo a conta e a
// enviar as credenciais por email).
function mostrarModalCredenciais(resultado) {
  if (credEmailInput) credEmailInput.value = resultado.pedido.email;
  if (credMensagem) {
    credMensagem.textContent = resultado.emailEnviado
      ? "Conta criada com sucesso. As credenciais de acesso foram enviadas por email diretamente à pessoa — não são mostradas aqui, por segurança."
      : "Conta criada, mas o envio do email falhou. Verifica o log do servidor (consola do backend) para perceber o motivo, e comunica o acesso à pessoa por outro meio.";
  }
  if (modalCredenciais) modalCredenciais.style.display = "flex";
  showToast("Conta criada!", "success");
}

if (formAprovar) {
  formAprovar.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!idPedidoAtual) return;

    try {
      const corpo = { role: selectRole.value };
      if (selectRole.value === "FORMANDO" && selectTurma && selectTurma.value) {
        corpo.turmaId = Number(selectTurma.value);
      }

      // A partir daqui a conta NÃO é criada já — o pedido fica "a aguardar
      // RH". A conta só é criada mesmo quando se confirma que os RH a
      // trataram (botão "Confirmar conta criada" na listagem).
      await api(`/pedidos-acesso/${idPedidoAtual}/aprovar`, {
        method: "PATCH",
        body: corpo,
      });

      if (modalAprovar) modalAprovar.style.display = "none";
      showToast("Pedido aprovado — fica a aguardar que os RH criem a conta.", "success");
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao aprovar pedido:", error);
      showToast(error.message || "Erro ao aprovar o pedido.", "error");
    }
  });
}
