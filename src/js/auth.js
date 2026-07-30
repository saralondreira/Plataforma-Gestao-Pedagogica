import { api, setSession } from "./api-client.js";
import { showToast } from "./toast.js";

const formLogin = document.getElementById("form-login");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnRegister = document.getElementById("btn-register");
const registoNomeInput = document.getElementById("registo-nome");
const registoRoleSelect = document.getElementById("registo-role");

if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const { token, user } = await api("/auth/login", {
        method: "POST",
        body: { email: emailInput.value, password: passwordInput.value },
      });

      setSession(token, user);
      showToast("Login efetuado com sucesso! A redirecionar...", "success");

      const destino = user.role === "FORMADOR" ? "dashboardFormador.html" : "dashboardCoord.html";
      setTimeout(() => {
        window.location.href = destino;
      }, 1500);
    } catch (error) {
      showToast("As credenciais estão incorretas. Tenta novamente.", "error");
    }
  });
}

if (btnRegister) {
  btnRegister.addEventListener("click", async () => {
    const nome = registoNomeInput.value.trim();
    const email = emailInput.value;
    const password = passwordInput.value;
    const role = registoRoleSelect.value;

    if (!nome || !email || !password) {
      showToast("Preenche o nome, email e palavra-passe.", "error");
      return;
    }

    try {
      await api("/auth/register", { method: "POST", body: { nome, email, password, role } });
      showToast("Credenciais criadas! Já podes entrar.", "success");
    } catch (error) {
      showToast(error.message || "Erro ao criar acesso.", "error");
    }
  });
}
