import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataPT, formatarHora } from "./formatos.js";

const role = getUser()?.role;
const conteudo = document.getElementById("sumarios-conteudo");
const modal = document.getElementById("modal-sumario");
const formSumario = document.getElementById("form-sumario");
const textoSumario = document.getElementById("sumario-texto");
const avisoModal = document.getElementById("modal-sumario-aviso");
let aulaEmEdicao = null;

const ESTADOS = {
  SUBMETIDO: '<span class="badge yellow">Por validar</span>',
  VALIDADO: '<span class="badge green">Validado</span>',
  REJEITADO: '<span class="badge red">Rejeitado</span>',
};

const quando = (aula) => `${formatarDataPT(aula.data)} ${formatarHora(aula.horaInicio)}`;

function cartao(titulo, cabecalhos, linhas, vazio) {
  const corpo = linhas.length
    ? linhas.join("")
    : `<tr class="linha-vazia"><td colspan="${cabecalhos.length}" style="text-align: center; padding: 18px; color: #64748b">${vazio}</td></tr>`;
  return `
    <div class="section-card table-standard" style="height: auto; margin-bottom: 20px">
      <div class="card-header-simple"><h3>${titulo}</h3></div>
      <div class="table-container-clean" style="height: auto; max-height: 420px">
        <table class="status-table"><thead><tr>${cabecalhos.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${corpo}</tbody></table>
      </div>
    </div>`;
}

// ------------------------------------------------------------ formador
async function desenharFormador() {
  const [porEscrever, meus, porValidar] = await Promise.all([api("/sumarios/por-escrever"), api("/sumarios/meus"), api("/sumarios/por-validar")]);

  const linhasEscrever = porEscrever.map(
    (a) => `<tr>
      <td>${quando(a)}</td><td><strong>${escapeHtml(a.turmaUc.uc.abreviatura)}</strong> — ${escapeHtml(a.turmaUc.uc.nome)}</td><td>${escapeHtml(a.turmaUc.turma.codigo)}</td>
      <td>${a.sumario ? `${ESTADOS.REJEITADO}<br><small style="color:#b91c1c">${escapeHtml(a.sumario.notaValidacao || "")}</small>` : '<span class="badge gray">Em falta</span>'}</td>
      <td><button class="btn-login btn-escrever" type="button" data-aula="${a.id}" data-texto="${a.sumario ? escapeHtml(a.sumario.texto) : ""}" data-aviso="${a.sumario ? escapeHtml(a.sumario.notaValidacao || "") : ""}" style="width: auto; display: inline-block; padding: 6px 14px">${a.sumario ? "Corrigir" : "Escrever"}</button></td></tr>`
  );
  const linhasMeus = meus.map(
    (s) => `<tr><td>${quando(s.aula)}</td><td><strong>${escapeHtml(s.aula.turmaUc.uc.abreviatura)}</strong></td><td>${escapeHtml(s.aula.turmaUc.turma.codigo)}</td><td>${ESTADOS[s.estado]}</td><td>${escapeHtml(s.texto.length > 90 ? `${s.texto.slice(0, 90)}…` : s.texto)}</td></tr>`
  );

  conteudo.innerHTML =
    cartao("Por escrever", ["Aula", "UC", "Turma", "Estado", ""], linhasEscrever, "Não tens sumários em falta. 🎉") +
    (porValidar.length ? blocoValidacao(porValidar, "Sumários por validar (como mediador)") : "") +
    cartao("Os meus sumários", ["Aula", "UC", "Turma", "Estado", "Resumo"], linhasMeus, "Ainda não escreveste nenhum sumário.");

  conteudo.querySelectorAll(".btn-escrever").forEach((b) =>
    b.addEventListener("click", () => abrirModal(Number(b.dataset.aula), b.dataset.texto, b.dataset.aviso))
  );
  ligarValidacao();
}

// ------------------------------------------------------------ validação (mediador / coordenação)
function blocoValidacao(lista, titulo) {
  const linhas = lista.map(
    (s) => `<tr>
      <td>${quando(s.aula)}</td><td><strong>${escapeHtml(s.aula.turmaUc.uc.abreviatura)}</strong></td><td>${escapeHtml(s.aula.turmaUc.turma.codigo)}</td>
      <td>${escapeHtml(s.escritoPor.nome)}</td><td style="max-width: 360px; white-space: pre-wrap">${escapeHtml(s.texto)}</td>
      <td style="white-space: nowrap">
        <button class="btn-icon btn-validar" data-id="${s.id}" title="Validar"><i class="ph ph-check-circle"></i></button>
        <button class="btn-icon btn-rejeitar" data-id="${s.id}" title="Rejeitar"><i class="ph ph-x-circle"></i></button>
      </td></tr>`
  );
  return cartao(titulo, ["Aula", "UC", "Turma", "Formador", "Sumário", ""], linhas, "");
}

function ligarValidacao() {
  conteudo.querySelectorAll(".btn-validar").forEach((b) => b.addEventListener("click", () => decidir(b.dataset.id, true)));
  conteudo.querySelectorAll(".btn-rejeitar").forEach((b) =>
    b.addEventListener("click", () => {
      const nota = window.prompt("Motivo da rejeição (o formador vê isto e corrige):");
      if (nota === null) return;
      if (!nota.trim()) {
        showToast("Indica o motivo da rejeição.", "error");
        return;
      }
      decidir(b.dataset.id, false, nota.trim());
    })
  );
}

async function decidir(id, aceite, nota) {
  try {
    await api(`/sumarios/${id}/decidir`, { method: "PATCH", body: { aceite, ...(nota ? { nota } : {}) } });
    showToast(aceite ? "Sumário validado." : "Sumário rejeitado — o formador foi avisado.", "success");
    iniciar();
  } catch (error) {
    showToast(error.message || "Erro ao decidir o sumário.", "error");
  }
}

async function desenharCoordenacao() {
  const lista = await api("/sumarios/por-validar");
  conteudo.innerHTML = lista.length
    ? blocoValidacao(lista, `Sumários por validar (${lista.length})`)
    : '<div class="section-card" style="height: auto"><p style="color: #64748b">Não há sumários por validar.</p></div>';
  ligarValidacao();
}

// ------------------------------------------------------------ formando
async function desenharFormando() {
  const lista = await api("/sumarios/turma");
  const linhas = lista.map(
    (s) => `<tr><td>${quando(s.aula)}</td><td><strong>${escapeHtml(s.aula.turmaUc.uc.abreviatura)}</strong> — ${escapeHtml(s.aula.turmaUc.uc.nome)}</td><td>${escapeHtml(s.aula.turmaUc.formador.nome)}</td><td style="white-space: pre-wrap">${escapeHtml(s.texto)}</td></tr>`
  );
  conteudo.innerHTML = cartao("Sumários da tua turma", ["Aula", "UC", "Formador", "Sumário"], linhas, "Ainda não há sumários validados.");
}

// ------------------------------------------------------------ modal de escrita
function abrirModal(aulaId, texto, aviso) {
  aulaEmEdicao = aulaId;
  textoSumario.value = texto || "";
  avisoModal.style.display = aviso ? "" : "none";
  avisoModal.textContent = aviso ? `Motivo da rejeição: ${aviso}` : "";
  modal.style.display = "flex";
}

document.getElementById("fechar-modal-sumario").addEventListener("click", () => (modal.style.display = "none"));

formSumario.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/sumarios/aula/${aulaEmEdicao}`, { method: "PUT", body: { texto: textoSumario.value.trim() } });
    modal.style.display = "none";
    showToast("Sumário submetido para validação.", "success");
    iniciar();
  } catch (error) {
    showToast(error.message || "Erro ao guardar o sumário.", "error");
  }
});

async function iniciar() {
  const subtitulo = document.getElementById("subtitulo-pagina");
  try {
    if (role === "FORMADOR") {
      subtitulo.textContent = "Escreve o sumário das aulas que deste; o mediador da turma valida-o.";
      await desenharFormador();
    } else if (role === "COORDENADOR") {
      subtitulo.textContent = "Valida os sumários submetidos pelos formadores.";
      await desenharCoordenacao();
    } else {
      subtitulo.textContent = "O que foi dado em cada aula da tua turma.";
      await desenharFormando();
    }
  } catch (error) {
    showToast(error.message || "Erro ao carregar os sumários.", "error");
  }
}

iniciar();
