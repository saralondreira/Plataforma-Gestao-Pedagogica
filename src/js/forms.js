import { api } from "./api-client.js";
import { showToast } from "./toast.js";

const formPedido = document.getElementById("form-pedido");

if (formPedido) {
  formPedido.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dados = {
      nome: document.getElementById("nome").value,
      email: document.getElementById("email").value,
      cargo: document.getElementById("cargo").value,
      motivo: document.getElementById("motivo").value,
    };

    try {
      await api("/pedidos-acesso", { method: "POST", body: dados });

      showToast("Pedido enviado com sucesso! Aguarde a aprovação da coordenação.", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (error) {
      console.error("Erro ao guardar o pedido: ", error);
      showToast(error.message || "Ocorreu um erro ao submeter o pedido. Tente novamente mais tarde.", "error");
    }
  });
}
