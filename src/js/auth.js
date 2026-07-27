import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
      .then(() => {
        showToast("Login efetuado com sucesso! A redirecionar...", "success");
        setTimeout(() => {
          window.location.href = "../pages/dashboardCoord.html";
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