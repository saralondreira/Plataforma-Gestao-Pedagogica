import { api, getUser } from "./api-client.js";
import { showToast } from "./toast.js";

const formPerfil = document.getElementById("form-perfil");
const nomeInput = document.getElementById("nome");
const contactoInput = document.getElementById("contacto");
const emailInput = document.getElementById("email");
const linkedinInput = document.getElementById("linkedin");
const competenciasTextarea = document.getElementById("competencias");
const roleSelect = document.getElementById("role");

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
