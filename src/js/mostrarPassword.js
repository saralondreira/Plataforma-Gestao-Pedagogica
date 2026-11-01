// Põe um botão "olho" em cada campo de palavra-passe para mostrar/ocultar o que se escreve.
const OLHO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_RISCADO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

document.querySelectorAll('input[type="password"]').forEach((campo) => {
  const envolucro = document.createElement("div");
  envolucro.style.position = "relative";
  campo.parentNode.insertBefore(envolucro, campo);
  envolucro.appendChild(campo);
  campo.style.paddingRight = "44px";

  const botao = document.createElement("button");
  botao.type = "button";
  botao.setAttribute("aria-label", "Mostrar palavra-passe");
  botao.innerHTML = OLHO;
  botao.style.cssText = "position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; display: flex";
  botao.addEventListener("click", () => {
    const visivel = campo.type === "text";
    campo.type = visivel ? "password" : "text";
    botao.innerHTML = visivel ? OLHO : OLHO_RISCADO;
    botao.setAttribute("aria-label", visivel ? "Mostrar palavra-passe" : "Ocultar palavra-passe");
  });
  envolucro.appendChild(botao);
});
