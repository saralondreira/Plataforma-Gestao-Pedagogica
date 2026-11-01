// Acessibilidade dos modais (.modal): papel de diálogo, foco dentro do modal enquanto está aberto,
// Esc para fechar e regresso do foco ao elemento que o abriu. Funciona para todos os modais da aplicação
// sem alterar o código que os abre e fecha (que só muda style.display).

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function estaAberto(modal) {
  return window.getComputedStyle(modal).display !== "none";
}

function focaveis(modal) {
  return [...modal.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
}

function prepararModal(modal) {
  const conteudo = modal.querySelector(".modal-content") || modal;
  conteudo.setAttribute("role", "dialog");
  conteudo.setAttribute("aria-modal", "true");
  const titulo = conteudo.querySelector("h1, h2, h3");
  if (titulo) {
    if (!titulo.id) titulo.id = `${modal.id || "modal"}-titulo`;
    conteudo.setAttribute("aria-labelledby", titulo.id);
  }

  let origem = null;
  let abertoAntes = estaAberto(modal);

  const aoMudar = () => {
    const aberto = estaAberto(modal);
    if (aberto && !abertoAntes) {
      origem = document.activeElement;
      const [primeiro] = focaveis(conteudo).filter((el) => !el.matches(".btn-icon"));
      (primeiro || focaveis(conteudo)[0] || conteudo).focus?.();
    } else if (!aberto && abertoAntes) {
      if (origem && document.contains(origem)) origem.focus?.();
      origem = null;
    }
    abertoAntes = aberto;
  };
  new MutationObserver(aoMudar).observe(modal, { attributes: true, attributeFilter: ["style", "class"] });

  modal.addEventListener("keydown", (evento) => {
    if (!estaAberto(modal)) return;
    if (evento.key === "Escape") {
      const fechar = modal.querySelector('[aria-label="Fechar"], .btn-icon');
      if (fechar) {
        evento.preventDefault();
        fechar.click();
      }
      return;
    }
    if (evento.key !== "Tab") return;
    const lista = focaveis(conteudo);
    if (lista.length === 0) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  });
}

function iniciar() {
  document.querySelectorAll(".modal").forEach(prepararModal);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
