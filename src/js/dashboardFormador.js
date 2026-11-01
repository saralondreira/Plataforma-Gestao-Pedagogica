import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const tbodyDocumentos = document.querySelector("#tabela-documentos-formador tbody");

const modalSubmeter = document.getElementById("modal-submeter");
const fecharModalSubmeter = document.getElementById("fechar-modal-submeter");
const formSubmeterDocumento = document.getElementById("form-submeter-documento");
const linkAbrirExcecao = document.getElementById("link-abrir-excecao");

const modalExcecao = document.getElementById("modal-excecao");
const fecharModalExcecao = document.getElementById("fechar-modal-excecao");
const formExcecao = document.getElementById("form-excecao");

let idAvisoAtual = null;

function calcularDias(dataAlvo) {
  const hoje = new Date();
  const prazo = new Date(dataAlvo);
  hoje.setHours(0, 0, 0, 0);
  prazo.setHours(0, 0, 0, 0);
  return Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
}

function abrirModalSubmeter(id) {
  idAvisoAtual = id;
  if (formSubmeterDocumento) formSubmeterDocumento.reset();
  if (modalSubmeter) modalSubmeter.style.display = "flex";
}

function fecharModais() {
  if (modalSubmeter) modalSubmeter.style.display = "none";
  if (modalExcecao) modalExcecao.style.display = "none";
  idAvisoAtual = null;
}

async function carregarDocumentos() {
  if (!tbodyDocumentos) return;

  try {
    const entregas = await api("/entregas/minhas");
    tbodyDocumentos.innerHTML = "";

    if (entregas.length === 0) {
      tbodyDocumentos.innerHTML = '<tr class="linha-vazia"><td colspan="6" style="text-align: center; padding: 20px;">Não tens documentos atribuídos.</td></tr>';
      return;
    }

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
      } else if (diasRestantes === 0) {
        textoPrazo = "Hoje";
        corPrazo = "#ca8a04";
        estado = "hoje";
        badgeHTML = '<span class="badge yellow">Hoje</span>';
      } else {
        textoPrazo = `Daqui a ${diasRestantes} dias`;
        corPrazo = "#2563eb";
        estado = "pendente";
        badgeHTML = '<span class="badge blue">Pendente</span>';
      }

      const dataFormatada = new Date(entrega.dataLimite).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
      const acaoHTML = entrega.entregue
        ? ""
        : `<button class="btn-icon btn-submeter" data-id="${entrega.id}" title="Submeter Documento"><i class="ph ph-upload-simple"></i></button>`;

      const tr = document.createElement("tr");
      tr.setAttribute("data-estado", estado);
      tr.innerHTML = `
                <td>${escapeHtml(entrega.turma.codigo)}</td>
                <td>${escapeHtml(entrega.documento)}</td>
                <td style="color: ${corPrazo}; font-weight: 500;">${textoPrazo}</td>
                <td><strong>${dataFormatada}</strong></td>
                <td>${badgeHTML}</td>
                <td>${acaoHTML}</td>
            `;
      tbodyDocumentos.appendChild(tr);
    });

    tbodyDocumentos.querySelectorAll(".btn-submeter").forEach((botao) => {
      botao.addEventListener("click", () => {
        abrirModalSubmeter(botao.getAttribute("data-id"));
      });
    });
  } catch (error) {
    console.error("Erro ao carregar documentos:", error);
    showToast(error.message || "Erro ao carregar documentos.", "error");
  }
}

const sessao = getUser();
if (!sessao) {
  window.location.href = "login.html";
} else {
  carregarDocumentos();
}

if (fecharModalSubmeter) fecharModalSubmeter.addEventListener("click", fecharModais);
if (fecharModalExcecao) fecharModalExcecao.addEventListener("click", fecharModais);

if (linkAbrirExcecao) {
  linkAbrirExcecao.addEventListener("click", (e) => {
    e.preventDefault();
    if (modalSubmeter) modalSubmeter.style.display = "none";
    if (formExcecao) formExcecao.reset();
    if (modalExcecao) modalExcecao.style.display = "flex";
  });
}

if (formSubmeterDocumento) {
  formSubmeterDocumento.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!idAvisoAtual) return;

    const ficheiroInput = document.getElementById("submeter-ficheiro");
    const ficheiro = ficheiroInput.files[0];
    if (!ficheiro) return;

    const formData = new FormData();
    formData.append("ficheiro", ficheiro);

    try {
      await api(`/entregas/${idAvisoAtual}/submeter`, { method: "POST", body: formData });
      showToast("Documento submetido com sucesso!", "success");
      fecharModais();
      carregarDocumentos();
    } catch (error) {
      console.error("Erro ao submeter documento:", error);
      showToast(error.message || "Ocorreu um erro ao submeter o documento.", "error");
    }
  });
}

if (formExcecao) {
  formExcecao.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!idAvisoAtual) return;

    const nota = document.getElementById("excecao-nota").value.trim();

    try {
      await api(`/entregas/${idAvisoAtual}/excecao`, { method: "POST", body: { nota } });
      showToast("Marcado como enviado (exceção).", "success");
      fecharModais();
      carregarDocumentos();
    } catch (error) {
      console.error("Erro ao guardar exceção:", error);
      showToast(error.message || "Ocorreu um erro ao guardar.", "error");
    }
  });
}
