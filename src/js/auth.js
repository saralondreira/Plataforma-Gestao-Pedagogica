import { api, setSession } from "./api-client.js";
import { showToast } from "./toast.js";

const formLogin = document.getElementById("form-login");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const { user } = await api("/auth/login", {
        method: "POST",
        body: { email: emailInput.value, password: passwordInput.value },
      });

      setSession(user);
      showToast("Login efetuado com sucesso! A redirecionar...", "success");

      let destino = "dashboardCoord.html";
      if (user.role === "FORMADOR") destino = "dashboardFormador.html";
      else if (user.role === "FORMANDO") destino = "dashboardFormando.html";
      setTimeout(() => {
        window.location.href = destino;
      }, 1500);
    } catch (error) {
      showToast(error.message || "Não foi possível fazer login — tenta novamente.", "error");
    }
  });
}
