// Guarda partilhada pelas páginas internas (tudo menos login.html e forms.html).
// - Sem sessão (sem dados do utilizador no browser, ou a API recusa o cookie): volta ao login.
// - <body data-roles="COORDENADOR,FORMADOR"> (opcional): se o papel da conta
//   não estiver na lista, redireciona para o dashboard do próprio papel.
// - Liga os botões "Terminar Sessão" (.logout) a terminarSessaoNoServidor() — antes eram só
//   um link para login.html e a sessão não terminava.
// - Monta o menu lateral: acrescenta as páginas de notas/assiduidade/trabalhos/
//   mensagens a todas as páginas; nas páginas novas (<nav data-auto>) monta o
//   menu inteiro e preenche o cabeçalho (nome, iniciais, papel).
// A API continua a ser a verdadeira barreira de segurança (JWT + requireRole);
// isto só evita mostrar páginas que não fazem sentido para a sessão atual.
import { getUser, terminarSessaoNoServidor } from "./api-client.js";
import { MENU, PAGINA_INICIAL, ROTULO_ROLE } from "./menu.js";

async function terminarSessao() {
  await terminarSessaoNoServidor();
  window.location.replace("login.html");
}

// Sem a extensão: o `npx serve` serve /pages/notas em vez de /pages/notas.html.
function semExtensao(nome) {
  return nome.replace(/\.html$/, "");
}

function paginaAtual() {
  return semExtensao(window.location.pathname.split("/").pop());
}

function criarLinkMenu({ href, icon, label }) {
  const a = document.createElement("a");
  a.href = href;
  a.className = "menu-item" + (paginaAtual() === semExtensao(href) ? " active" : "");
  const i = document.createElement("i");
  i.className = `ph ${icon}`;
  const span = document.createElement("span");
  span.className = "link-text";
  span.textContent = label;
  a.append(i, span);
  return a;
}

function montarMenu(role) {
  const definicao = MENU[role];
  if (!definicao) return;

  document.querySelectorAll(".sidebar-menu").forEach((nav) => {
    const itens = nav.hasAttribute("data-auto") ? [...definicao.base, ...definicao.extras] : definicao.extras;
    itens.forEach((item) => {
      if (!nav.querySelector(`a[href="${item.href}"]`)) nav.appendChild(criarLinkMenu(item));
    });
  });
}

function preencherCabecalho(utilizador) {
  const nome = (utilizador.nome || "").trim();
  document.querySelectorAll(".user-name strong").forEach((el) => {
    if (nome) el.textContent = nome;
  });

  const partes = nome.split(/\s+/).filter(Boolean);
  const iniciais = partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] || "?").slice(0, 2);
  document.querySelectorAll(".user-profile-header .avatar-circle").forEach((av) => {
    av.textContent = iniciais.toUpperCase();
  });

  // O rótulo do papel só é preenchido nas páginas novas (as antigas já o têm).
  if (document.querySelector(".sidebar-menu[data-auto]")) {
    document.querySelectorAll(".user-role").forEach((el) => {
      el.textContent = ROTULO_ROLE[utilizador.role] || utilizador.role;
    });
    document.querySelectorAll("[data-home-link]").forEach((el) => {
      el.href = PAGINA_INICIAL[utilizador.role] || "login.html";
    });
  }
}

const utilizador = getUser();

if (!utilizador) {
  terminarSessao();
} else {
  const permitidos = (document.body.dataset.roles || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  if (permitidos.length > 0 && !permitidos.includes(utilizador.role)) {
    window.location.replace(PAGINA_INICIAL[utilizador.role] || "login.html");
  } else {
    montarMenu(utilizador.role);
    preencherCabecalho(utilizador);
  }

  document.querySelectorAll(".logout").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      terminarSessao();
    });
  });
}
