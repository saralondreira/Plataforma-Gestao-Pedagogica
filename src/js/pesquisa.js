import { api } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";

const campo = document.getElementById("campo-pesquisa");
const resultados = document.getElementById("resultados-pesquisa");
let temporizador = null;
let pedidoAtual = 0;

function secao(titulo, itens, vazio = false) {
  if (itens.length === 0) return "";
  return `
    <div class="section-card" style="height: auto; margin-bottom: 15px">
      <div class="card-header-simple"><h3>${titulo} <span style="color: #94a3b8; font-weight: 400">(${itens.length})</span></h3></div>
      <ul style="list-style: none; padding: 0; margin: 0">${itens.join("")}</ul>
    </div>`;
}

const linha = (href, principal, secundario) =>
  `<li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9"><a href="${href}" style="text-decoration: none"><strong>${principal}</strong></a> <span style="color: #64748b">${secundario}</span></li>`;

function desenhar(r) {
  const html =
    secao("Turmas", r.turmas.map((t) => linha(`turmaUcs.html?turmaId=${t.id}`, escapeHtml(t.codigo), `— ${escapeHtml(t.designacao)}`))) +
    secao("Formadores", r.formadores.map((f) => linha("formadores.html", escapeHtml(f.nome), `${f.sigla ? `(${escapeHtml(f.sigla)}) ` : ""}${escapeHtml(f.email)}`))) +
    secao("Formandos", r.formandos.map((f) => linha("formandos.html", escapeHtml(f.nome), `${escapeHtml(f.email)}${f.turma ? ` · ${escapeHtml(f.turma.codigo)}` : " · sem turma"}`))) +
    secao("UCs do catálogo", r.ucs.map((u) => linha("turmas.html", escapeHtml(u.abreviatura), `— ${escapeHtml(u.nome)} (${u.cargaHoraria}h)`)));

  resultados.innerHTML = html || `<div class="section-card" style="height: auto"><p style="color: #64748b">Nada encontrado para "${escapeHtml(r.termo)}".</p></div>`;
}

async function pesquisar() {
  const termo = campo.value.trim();
  if (termo.length < 2) {
    resultados.innerHTML = "";
    return;
  }
  const meu = ++pedidoAtual; // ignora respostas antigas se escreveres depressa
  try {
    const r = await api(`/pesquisa?q=${encodeURIComponent(termo)}`);
    if (meu === pedidoAtual) desenhar(r);
  } catch (error) {
    showToast(error.message || "Erro na pesquisa.", "error");
  }
}

campo.addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(pesquisar, 300);
});
