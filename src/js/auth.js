import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const formLogin = document.getElementById('form-login');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnRegister = document.getElementById('btn-register');

if (formLogin) {
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
      .then(async (credenciais) => {
        showToast("Login efetuado com sucesso! A redirecionar...", "success");

        let destino = "dashboardCoord.html";
        try {
          const perfilDoc = await getDoc(doc(db, "perfis", credenciais.user.uid));
          if (perfilDoc.exists() && perfilDoc.data().role === "formador") {
            destino = "dashboardFormador.html";
          }
        } catch (error) {
          console.error("Erro ao verificar perfil:", error);
        }

        setTimeout(() => {
          window.location.href = destino;
        }, 1500);
      })
      .catch(() => {
        showToast("As credenciais estão incorretas. Tenta novamente.", "error");
      });
  });
}

if (btnRegister) {
  btnRegister.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!email || !password) {
      showToast("Preenche o email e a palavra-passe.", "error");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then(() => {
        showToast("Credenciais criadas! Já podes entrar.", "success");
      })
      .catch((error) => {
        if (error.code === 'auth/email-already-in-use') {
          showToast("Este email já tem acesso à plataforma.", "error");
        } else if (error.code === 'auth/weak-password') {
          showToast("A palavra-passe deve ter pelo menos 6 caracteres.", "error");
        } else {
          showToast("Erro ao criar acesso: " + error.message, "error");
        }
      });
  });
}