import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";

const formPerfil = document.getElementById("form-perfil");
const nomeInput = document.getElementById("nome");
const contactoInput = document.getElementById("contacto");
const emailInput = document.getElementById("email");
const linkedinInput = document.getElementById("linkedin");
const competenciasTextarea = document.getElementById("competencias");
const roleSelect = document.getElementById("role");

// "Turmas (Atuais)": vem da API conforme o papel (antes mostrava duas turmas fixas do protótipo).
async function carregarTurmasDoPerfil(dados) {
  const campo = document.getElementById("perfil-turmas");
  if (!campo) return;
  try {
    if (dados.role === "COORDENADOR") {
      campo.value = "Todas as turmas (coordenação)";
      return;
    }
    const associacoes = dados.role === "FORMADOR" ? await api("/turma-ucs/minhas") : dados.turmaId ? await api(`/turma-ucs/turma/${dados.turmaId}`) : [];
    const turmas = new Map(associacoes.map((a) => [a.turma.id, `${a.turma.codigo} — ${a.turma.designacao}`]));
    campo.value = turmas.size ? [...turmas.values()].join(String.fromCharCode(10)) : "Sem turmas associadas";
  } catch (error) {
    campo.value = "";
  }
}

async function carregarPerfil() {
  const sessao = getUser();
  if (!sessao) {
    showToast("Sessão expirada. A redirecionar...", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
    return;
  }

  try {
    const dados = await api("/auth/me");

    if (emailInput) emailInput.value = dados.email;
    if (nomeInput) nomeInput.value = dados.nome || "";
    if (contactoInput) contactoInput.value = dados.contacto || "";
    if (linkedinInput) linkedinInput.value = dados.linkedin || "";
    if (competenciasTextarea) competenciasTextarea.value = dados.competencias || "";
    if (roleSelect) roleSelect.value = dados.role;

    atualizarNomeCabecalho(dados.nome);
    ajustarSidebarPorRole(dados.role);
    carregarTurmasDoPerfil(dados);
  } catch (error) {
    console.error("Erro ao carregar dados do perfil:", error);
    showToast(error.message || "Erro ao carregar perfil.", "error");
  }
}

carregarPerfil();

if (formPerfil) {
  formPerfil.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      nome: nomeInput.value.trim(),
      contacto: contactoInput.value.trim(),
      linkedin: linkedinInput.value.trim(),
      competencias: competenciasTextarea.value.trim(),
    };

    try {
      await api("/auth/me", { method: "PATCH", body: dados });
      showToast("Perfil atualizado com sucesso!", "success");
      atualizarNomeCabecalho(dados.nome);
    } catch (error) {
      console.error("Erro ao guardar perfil:", error);
      showToast(error.message || "Ocorreu um erro ao guardar as alterações.", "error");
    }
  });
}

const DESTINO_POR_ROLE = {
  COORDENADOR: "dashboardCoord.html",
  FORMADOR: "dashboardFormador.html",
  FORMANDO: "dashboardFormando.html",
};

const ROTULO_POR_ROLE = {
  COORDENADOR: "Coordenador(a)",
  FORMADOR: "Formador(a)",
  FORMANDO: "Formando(a)",
};

// perfil.html é partilhado pelos três papéis — a barra lateral e os links de
// "voltar ao início" no cabeçalho vinham sempre fixos no menu de coordenação,
// mesmo para quem tinha sessão como formador ou formando. Ajusta tudo isto
// de acordo com o papel real da conta autenticada.
function ajustarSidebarPorRole(role) {
  document.querySelectorAll(".menu-item[data-role]").forEach((item) => {
    item.style.display = item.getAttribute("data-role") === role ? "" : "none";
  });

  const destino = DESTINO_POR_ROLE[role] || "login.html";
  const logoLink = document.getElementById("logo-home-link");
  const homeLinkNome = document.getElementById("home-link-nome");
  const homeLinkRole = document.getElementById("home-link-role");
  if (logoLink) logoLink.href = destino;
  if (homeLinkNome) homeLinkNome.href = destino;
  if (homeLinkRole) homeLinkRole.href = destino;

  const textoRole = document.getElementById("texto-user-role");
  if (textoRole) textoRole.textContent = ROTULO_POR_ROLE[role] || role;
}

function atualizarNomeCabecalho(nome) {
  if (!nome) return;
  document.querySelectorAll(".user-name strong").forEach((el) => {
    el.innerText = nome;
  });

  const partes = nome.split(/\s+/);
  if (partes.length >= 2) {
    const iniciais = (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
    document.querySelectorAll(".avatar-circle").forEach((av) => {
      if (!av.closest("td")) av.innerText = iniciais;
    });
  }
}
