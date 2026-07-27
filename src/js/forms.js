import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const formPedido = document.getElementById("form-pedido");

if (formPedido) {
  formPedido.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nome").value;
    const email = document.getElementById("email").value;
    const cargo = document.getElementById("cargo").value;
    const motivo = document.getElementById("motivo").value;

    try {
      await addDoc(collection(db, "pedidos_acesso"), {
        nome: nome,
        email: email,
        cargo: cargo,
        motivo: motivo,
        estado: "pendente",
        dataCriacao: serverTimestamp(),
      });

      showToast(
        "Pedido enviado com sucesso! Aguarde a aprovação da coordenação.",
        "success",
      );
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } catch (error) {
      console.error("Erro ao guardar o pedido: ", error);
      showToast(
        "Ocorreu um erro ao submeter o pedido. Tente novamente mais tarde.",
        "error",
      );
    }
  });
}
