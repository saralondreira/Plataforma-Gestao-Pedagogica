import { api } from "./api-client.js";
import { showToast } from "./toast.js";

const formEsqueci = document.getElementById("form-esqueci");
const formRedefinir = document.getElementById("form-redefinir");

if (formEsqueci) {
  formEsqueci.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/auth/esqueci-password", { method: "POST", body: { email: document.getElementById("email").value.trim() } });
      formEsqueci.reset();
      showToast("Se o email existir na plataforma, enviámos-te uma ligação. Verifica a caixa de entrada.", "success");
    } catch (error) {
      showToast(error.message || "Não foi possível enviar o pedido — tenta novamente.", "error");
    }
  });
}

if (formRedefinir) {
  // O token vem no fragmento (#token=...): sobrevive a redirecionamentos do servidor e nunca é enviado para ele.
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (!token) {
    showToast("Ligação inválida — pede uma nova em \"Esqueci a palavra-passe\".", "error");
  }

  formRedefinir.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;
    if (password !== document.getElementById("password2").value) {
      showToast("As palavras-passe não coincidem.", "error");
      return;
    }
    try {
      await api("/auth/redefinir-password", { method: "POST", body: { token, password } });
      showToast("Palavra-passe alterada! A redirecionar para o login...", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1800);
    } catch (error) {
      showToast(error.message || "Não foi possível alterar a palavra-passe.", "error");
    }
  });
}
