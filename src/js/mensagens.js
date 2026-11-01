import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataHoraPT, mostrar } from "./formatos.js";

const role = getUser()?.role;

const DESTINOS_POR_ROLE = {
  FORMANDO: [
    ["COORDENACAO", "Coordenação"],
    ["ASSISTENTE_SOCIAL", "Assistente social"],
    ["FORMADOR", "Um formador da minha turma"],
  ],
  FORMADOR: [["COORDENACAO", "Coordenação"]],
  COORDENADOR: [["FORMADOR", "Um formador"]],
};

const ROTULO_DESTINO = { COORDENACAO: "Coordenação", ASSISTENTE_SOCIAL: "Assistente social" };

const modalNova = document.getElementById("modal-nova-mensagem");
const formNova = document.getElementById("form-nova-mensagem");
const selectDestino = document.getElementById("msg-destino");
const grupoDestinatario = document.getElementById("grupo-destinatario");
const selectDestinatario = document.getElementById("msg-destinatario");

const modalResponder = document.getElementById("modal-responder");
const formResponder = document.getElementById("form-responder");
let mensagemEmResposta = null;

function textoMensagem(texto) {
  return `<span style="white-space: pre-wrap">${escapeHtml(texto)}</span>`;
}

async function carregarRecebidas() {
  if (role === "FORMANDO") return;
  mostrar(document.getElementById("cartao-recebidas"), true);
  const tbody = document.querySelector("#tabela-recebidas tbody");

  try {
    const mensagens = await api("/mensagens/recebidas");
    if (mensagens.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">Não tens mensagens recebidas.</td></tr>';
      return;
    }

    tbody.innerHTML = mensagens
      .map((m) => {
        const estado = m.resposta
          ? '<span class="badge green">Respondida</span>'
          : m.lida
            ? '<span class="badge blue">Lida</span>'
            : '<span class="badge yellow">Nova</span>';
        const social = m.destino === "ASSISTENTE_SOCIAL" ? ' <span class="badge blue">Assistente social</span>' : "";
        const acoes = [
          !m.lida ? `<button class="btn-icon btn-lida" data-id="${m.id}" title="Marcar como lida"><i class="ph ph-envelope-open"></i></button>` : "",
          !m.resposta
            ? `<button class="btn-icon btn-responder" data-id="${m.id}" data-assunto="${escapeHtml(m.assunto)}" title="Responder"><i class="ph ph-arrow-bend-up-left"></i></button>`
            : "",
        ].join("");
        return `
        <tr${m.lida ? "" : ' style="font-weight: 600"'}>
          <td>${escapeHtml(m.remetente.nome)}</td>
          <td>${escapeHtml(m.assunto)}${social}</td>
          <td>${textoMensagem(m.corpo)}${m.resposta ? `<br /><small style="color: #16a34a">Resposta: ${escapeHtml(m.resposta)}</small>` : ""}</td>
          <td>${formatarDataHoraPT(m.createdAt)}</td>
          <td>${estado}</td>
          <td>${acoes || "—"}</td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-lida").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/mensagens/${b.getAttribute("data-id")}/lida`, { method: "PATCH" });
          carregarRecebidas();
        } catch (error) {
          showToast(error.message || "Erro ao marcar como lida.", "error");
        }
      })
    );
    tbody.querySelectorAll(".btn-responder").forEach((b) =>
      b.addEventListener("click", () => {
        mensagemEmResposta = b.getAttribute("data-id");
        document.getElementById("responder-info").textContent = `Re: ${b.getAttribute("data-assunto")}`;
        formResponder.reset();
        modalResponder.style.display = "flex";
      })
    );
  } catch (error) {
    showToast(error.message || "Erro ao carregar as mensagens recebidas.", "error");
  }
}

async function carregarEnviadas() {
  const tbody = document.querySelector("#tabela-enviadas tbody");
  try {
    const mensagens = await api("/mensagens/enviadas");
    if (mensagens.length === 0) {
      tbody.innerHTML =
        '<tr class="linha-vazia"><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">Ainda não enviaste mensagens.</td></tr>';
      return;
    }

    tbody.innerHTML = mensagens
      .map((m) => {
        const para = m.destinatario ? m.destinatario.nome : ROTULO_DESTINO[m.destino] || m.destino;
        const resposta = m.resposta
          ? `${textoMensagem(m.resposta)}<br /><small style="color: #64748b">${formatarDataHoraPT(m.respondidaEm)}</small>`
          : '<span style="color: #94a3b8">Ainda sem resposta</span>';
        return `
        <tr>
          <td>${escapeHtml(para)}</td>
          <td>${escapeHtml(m.assunto)}</td>
          <td>${textoMensagem(m.corpo)}</td>
          <td>${formatarDataHoraPT(m.createdAt)}</td>
          <td>${resposta}</td>
        </tr>`;
      })
      .join("");
  } catch (error) {
    showToast(error.message || "Erro ao carregar as mensagens enviadas.", "error");
  }
}

async function carregarDestinatarios() {
  selectDestinatario.innerHTML = '<option value="">— Seleciona —</option>';
  try {
    const formadores = await api("/mensagens/destinatarios");
    formadores.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.nome;
      selectDestinatario.appendChild(opt);
    });
    if (formadores.length === 0) {
      showToast("Não há formadores disponíveis para receber mensagens.", "error");
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar os formadores.", "error");
  }
}

function atualizarCampoDestinatario() {
  const precisa = selectDestino.value === "FORMADOR";
  mostrar(grupoDestinatario, precisa);
  selectDestinatario.required = precisa;
  if (precisa) carregarDestinatarios();
}

document.getElementById("btn-nova-mensagem").addEventListener("click", () => {
  formNova.reset();
  selectDestino.innerHTML = (DESTINOS_POR_ROLE[role] || []).map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`).join("");
  atualizarCampoDestinatario();
  modalNova.style.display = "flex";
});
selectDestino.addEventListener("change", atualizarCampoDestinatario);
document.getElementById("fechar-modal-nova-mensagem").addEventListener("click", () => {
  modalNova.style.display = "none";
});
document.getElementById("fechar-modal-responder").addEventListener("click", () => {
  modalResponder.style.display = "none";
});

formNova.addEventListener("submit", async (e) => {
  e.preventDefault();
  const corpo = {
    destino: selectDestino.value,
    assunto: document.getElementById("msg-assunto").value.trim(),
    corpo: document.getElementById("msg-corpo").value.trim(),
  };
  if (corpo.destino === "FORMADOR") corpo.destinatarioId = Number(selectDestinatario.value);

  try {
    await api("/mensagens", { method: "POST", body: corpo });
    modalNova.style.display = "none";
    showToast("Mensagem enviada.", "success");
    carregarEnviadas();
  } catch (error) {
    showToast(error.message || "Erro ao enviar a mensagem.", "error");
  }
});

formResponder.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/mensagens/${mensagemEmResposta}/responder`, {
      method: "PATCH",
      body: { resposta: document.getElementById("responder-texto").value.trim() },
    });
    modalResponder.style.display = "none";
    showToast("Resposta enviada.", "success");
    carregarRecebidas();
  } catch (error) {
    showToast(error.message || "Erro ao responder.", "error");
  }
});

carregarRecebidas();
carregarEnviadas();
