import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./sanitize.js";
import { formatarDataHoraPT } from "./formatos.js";

const role = getUser()?.role;
const conteudo = document.getElementById("comunicados-conteudo");
const blocoEnvio = document.getElementById("comunicados-envio");
const formComunicado = document.getElementById("form-comunicado");
const selTurma = document.getElementById("com-turma");
const gere = role === "FORMADOR" || role === "COORDENADOR";

function cartoes(lista, vazio) {
  if (!lista.length) {
    return `<div class="section-card" style="height: auto"><p style="color: #64748b">${vazio}</p></div>`;
  }
  return lista
    .map(
      (c) => `<div class="section-card" style="height: auto; margin-bottom: 15px">
        <div class="card-header-simple">
          <h3>${escapeHtml(c.assunto)}</h3>
          ${gere ? `<button class="btn-icon btn-remover" data-id="${c.id}" title="Remover"><i class="ph ph-trash"></i></button>` : ""}
        </div>
        <p style="color: #64748b; font-size: 13px; margin-bottom: 10px">${escapeHtml(c.turma.codigo)} · ${escapeHtml(c.autor.nome)} · ${formatarDataHoraPT(c.createdAt)}</p>
        <p style="white-space: pre-wrap">${escapeHtml(c.corpo)}</p>
      </div>`
    )
    .join("");
}

async function carregar() {
  try {
    const lista = await api(gere ? "/comunicados/enviados" : "/comunicados/turma");
    conteudo.innerHTML = cartoes(lista, gere ? "Ainda não enviaste nenhum comunicado." : "Ainda não há comunicados para a tua turma.");
    conteudo.querySelectorAll(".btn-remover").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!window.confirm("Remover este comunicado? Deixa de aparecer aos formandos.")) return;
        try {
          await api(`/comunicados/${b.dataset.id}`, { method: "DELETE" });
          showToast("Comunicado removido.", "success");
          carregar();
        } catch (error) {
          showToast(error.message || "Erro ao remover o comunicado.", "error");
        }
      })
    );
  } catch (error) {
    showToast(error.message || "Erro ao carregar os comunicados.", "error");
  }
}

async function iniciar() {
  document.getElementById("subtitulo-pagina").textContent = gere
    ? "Avisos do mediador (ou da coordenação) a todos os formandos de uma turma."
    : "Avisos do mediador e da coordenação para a tua turma.";
  if (gere) {
    blocoEnvio.style.display = "";
    try {
      const turmas = await api("/comunicados/turmas");
      selTurma.innerHTML = turmas.map((t) => `<option value="${t.id}">${escapeHtml(t.codigo)} — ${escapeHtml(t.designacao)}</option>`).join("");
      if (!turmas.length) {
        formComunicado.style.display = "none";
        document.getElementById("sem-turmas").style.display = "";
      }
    } catch (error) {
      showToast(error.message || "Erro ao carregar as turmas.", "error");
    }
  }
  carregar();
}

formComunicado.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const r = await api("/comunicados", {
      method: "POST",
      body: { turmaId: Number(selTurma.value), assunto: document.getElementById("com-assunto").value.trim(), corpo: document.getElementById("com-corpo").value.trim() },
    });
    document.getElementById("com-assunto").value = "";
    document.getElementById("com-corpo").value = "";
    showToast(`Comunicado enviado a ${r.destinatarios} formando(s).`, "success");
    carregar();
  } catch (error) {
    showToast(error.message || "Erro ao enviar o comunicado.", "error");
  }
});

iniciar();
