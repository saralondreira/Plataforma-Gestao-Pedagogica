import { api, getUser, descarregarFicheiroProtegido } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataHoraPT } from "./formatos.js";

const role = getUser()?.role;
const conteudo = document.getElementById("documentos-conteudo");
const seletor = document.getElementById("documentos-seletor");
const envio = document.getElementById("documentos-envio");
const selTurma = document.getElementById("sel-turma");
const selUc = document.getElementById("sel-uc");
const chkHistorico = document.getElementById("chk-historico");
const grupoHistorico = document.getElementById("grupo-historico");
const formDocumento = document.getElementById("form-documento");

const CATEGORIAS = { MATERIAL: "Material", PLANO: "Plano", AVALIACAO: "Avaliação", OUTRO: "Outro" };
const gere = role === "FORMADOR" || role === "COORDENADOR";

function tamanho(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function tabela(lista, { mostrarUc }) {
  if (!lista.length) {
    return '<div class="section-card" style="height: auto"><p style="color: #64748b">Ainda não há documentos.</p></div>';
  }
  const linhas = lista.map(
    (d) => `<tr style="${d.ativo ? "" : "opacity: 0.55"}">
      ${mostrarUc ? `<td><strong>${escapeHtml(d.turmaUc.uc.abreviatura)}</strong></td>` : ""}
      <td>${escapeHtml(d.nomePadrao)}<br><small style="color:#64748b">${escapeHtml(d.nomeOriginal)}</small></td>
      <td>${CATEGORIAS[d.categoria]}</td>
      <td>${tamanho(d.tamanho)}</td>
      <td>${escapeHtml(d.enviadoPor.nome)}<br><small style="color:#64748b">${formatarDataHoraPT(d.createdAt)}</small></td>
      <td>${d.ativo ? "" : `<span class="badge gray">Removido ${formatarDataHoraPT(d.removidoEm)}</span>`}</td>
      <td style="white-space: nowrap">
        <button class="btn-icon btn-abrir" data-id="${d.id}" data-nome="${escapeHtml(d.nomePadrao)}" title="Descarregar"><i class="ph ph-download-simple"></i></button>
        ${gere && d.ativo ? `<button class="btn-icon btn-remover" data-id="${d.id}" title="Remover"><i class="ph ph-trash"></i></button>` : ""}
      </td></tr>`
  );
  return `
    <div class="section-card table-standard" style="height: auto">
      <div class="table-container-clean" style="height: auto; max-height: 520px">
        <table class="status-table"><thead><tr>${mostrarUc ? "<th>UC</th>" : ""}<th>Documento</th><th>Categoria</th><th>Tamanho</th><th>Enviado por</th><th></th><th></th></tr></thead>
        <tbody>${linhas.join("")}</tbody></table>
      </div>
    </div>`;
}

function ligarAcoes(recarregar) {
  conteudo.querySelectorAll(".btn-abrir").forEach((b) =>
    b.addEventListener("click", () => descarregarFicheiroProtegido(`/documentos/${b.dataset.id}/ficheiro`, b.dataset.nome).catch((e) => showToast(e.message, "error")))
  );
  conteudo.querySelectorAll(".btn-remover").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!window.confirm("Remover este documento? Deixa de aparecer aos formandos, mas fica no histórico.")) return;
      try {
        await api(`/documentos/${b.dataset.id}`, { method: "DELETE" });
        showToast("Documento removido.", "success");
        recarregar();
      } catch (error) {
        showToast(error.message || "Erro ao remover o documento.", "error");
      }
    })
  );
}

let pedidoDocumentos = 0;

async function carregarDaUc() {
  const pedido = ++pedidoDocumentos; // ignora respostas de seleções entretanto trocadas
  if (!selUc.value) {
    conteudo.innerHTML = '<div class="section-card" style="height: auto"><p style="color: #64748b">Não há UCs disponíveis.</p></div>';
    envio.style.display = "none";
    return;
  }
  envio.style.display = "";
  const historico = chkHistorico.checked ? "?historico=1" : "";
  try {
    const lista = await api(`/documentos/turma-uc/${selUc.value}${historico}`);
    if (pedido !== pedidoDocumentos) return;
    conteudo.innerHTML = tabela(lista, { mostrarUc: false });
    ligarAcoes(carregarDaUc);
  } catch (error) {
    showToast(error.message || "Erro ao carregar os documentos.", "error");
  }
}

async function preencherUcs(lista) {
  selUc.innerHTML = lista.map((t) => `<option value="${t.id}">${escapeHtml(t.uc.abreviatura)} — ${escapeHtml(t.uc.nome)}${role === "FORMADOR" ? ` (${escapeHtml(t.turma.codigo)})` : ""}</option>`).join("");
  await carregarDaUc();
}

async function iniciarGestao() {
  seletor.style.display = "";
  grupoHistorico.style.display = "";
  if (role === "FORMADOR") {
    document.getElementById("subtitulo-pagina").textContent = "Envia os materiais das tuas UCs; os formandos da turma são avisados.";
    await preencherUcs(await api("/turma-ucs/minhas"));
    return;
  }
  document.getElementById("subtitulo-pagina").textContent = "Repositório de documentos por UC, com histórico de envios.";
  document.getElementById("grupo-turma").style.display = "";
  const turmas = await api("/turmas");
  selTurma.innerHTML = turmas.map((t) => `<option value="${t.id}">${escapeHtml(t.codigo)} — ${escapeHtml(t.designacao)}</option>`).join("");
  const porTurma = async () => (selTurma.value ? preencherUcs(await api(`/turma-ucs/turma/${selTurma.value}`)) : preencherUcs([]));
  selTurma.addEventListener("change", porTurma);
  await porTurma();
}

async function iniciarFormando() {
  document.getElementById("subtitulo-pagina").textContent = "Materiais e documentos das UCs da tua turma.";
  const lista = await api("/documentos/turma");
  conteudo.innerHTML = tabela(lista, { mostrarUc: true });
  ligarAcoes(iniciarFormando);
}

// Zona de arrastar e largar: o <input type="file"> continua a ser o campo real (clicar também funciona)
const MAX_BYTES = 10 * 1024 * 1024;
const zona = document.getElementById("doc-zona");
const zonaTexto = document.getElementById("doc-zona-texto");
const inputFicheiro = document.getElementById("doc-ficheiro");
const TEXTO_ZONA = zonaTexto.textContent;

function atualizarZona() {
  const f = inputFicheiro.files[0];
  zona.classList.toggle("com-ficheiro", Boolean(f));
  zonaTexto.textContent = f ? `${f.name} (${tamanho(f.size)})` : TEXTO_ZONA;
}

function aceitarFicheiro(f) {
  if (f.size > MAX_BYTES) {
    inputFicheiro.value = "";
    atualizarZona();
    showToast("O ficheiro tem mais de 10 MB.", "error");
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(f);
  inputFicheiro.files = dt.files;
  atualizarZona();
}

["dragenter", "dragover"].forEach((ev) =>
  zona.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.add("ativa");
  })
);
["dragleave", "drop"].forEach((ev) =>
  zona.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.remove("ativa");
  })
);
zona.addEventListener("drop", (e) => {
  const lista = e.dataTransfer?.files;
  if (!lista || !lista.length) return;
  if (lista.length > 1) showToast("Só é possível enviar um ficheiro de cada vez — foi usado o primeiro.", "error");
  aceitarFicheiro(lista[0]);
});
inputFicheiro.addEventListener("change", () => {
  const f = inputFicheiro.files[0];
  if (f && f.size > MAX_BYTES) aceitarFicheiro(f);
  else atualizarZona();
});
formDocumento.addEventListener("reset", () => setTimeout(atualizarZona, 0));

selUc.addEventListener("change", carregarDaUc);
chkHistorico.addEventListener("change", carregarDaUc);

formDocumento.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ficheiro = document.getElementById("doc-ficheiro").files[0];
  if (!ficheiro) return;
  const corpo = new FormData();
  corpo.append("categoria", document.getElementById("doc-categoria").value);
  corpo.append("ficheiro", ficheiro);
  try {
    await api(`/documentos/turma-uc/${selUc.value}`, { method: "POST", body: corpo });
    formDocumento.reset();
    showToast("Documento enviado.", "success");
    carregarDaUc();
  } catch (error) {
    showToast(error.message || "Erro ao enviar o documento.", "error");
  }
});

(async () => {
  try {
    if (gere) await iniciarGestao();
    else await iniciarFormando();
  } catch (error) {
    showToast(error.message || "Erro ao carregar os documentos.", "error");
  }
})();
