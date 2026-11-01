import "./modais.js"; // acessibilidade dos modais (foco, Esc, role="dialog")

// Endereço da API: pode ser definido por página (<meta name="api-origin" content="https://api.exemplo.pt">)
// ou por window.API_ORIGIN; por omissão usa o mesmo servidor da página, na porta 4000.
function descobrirOrigemDaApi() {
  const meta = document.querySelector('meta[name="api-origin"]')?.content;
  const definida = window.API_ORIGIN || meta;
  if (definida) return String(definida).replace(/\/+$/, "");
  const host = window.location.hostname || "localhost";
  return `${window.location.protocol === "https:" ? "https:" : "http:"}//${host}:4000`;
}

export const API_ORIGIN = descobrirOrigemDaApi();
const API_BASE_URL = `${API_ORIGIN}/api/v1`;
// A sessão (JWT) vive num cookie httpOnly definido pela API: o JavaScript da página nunca a vê, por isso
// um XSS não a consegue roubar. Aqui guardam-se só os dados públicos do utilizador (nome, papel), para
// montar a interface; quem decide se a sessão é válida é sempre a API.
const USER_KEY = "pedagogica_user";
const LEGADO_TOKEN_KEY = "pedagogica_token"; // versões antigas guardavam o token aqui

// Cabeçalho que a API exige nos pedidos por cookie que alteram dados (proteção CSRF).
const CABECALHOS_BASE = { "X-Requested-With": "pedagogica" };

try {
  localStorage.removeItem(LEGADO_TOKEN_KEY);
} catch (erro) {
  // sem acesso ao armazenamento: nada a limpar
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (erro) {
    // Valor corrompido: descarta a sessão em vez de rebentar cada página.
    clearSession();
    return null;
  }
}

export function setSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(USER_KEY);
}

// Termina a sessão no servidor (apaga o cookie) e no browser.
export async function terminarSessaoNoServidor() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include", headers: CABECALHOS_BASE });
  } catch (erro) {
    // sem ligação ao servidor: o cookie expira sozinho
  }
  clearSession();
}

// Sessão expirada/inválida ou conta desativada: limpa o token e volta ao login.
function terminarSessaoSeInvalida(status, codigo) {
  if (status === 401 || codigo === "CONTA_INATIVA") {
    clearSession();
    window.location.replace("login.html");
  }
}

// Só estes tipos são mostrados no separador; o resto (ex.: HTML, SVG) é descarregado,
// para um ficheiro carregado por um utilizador nunca correr no contexto da aplicação.
const TIPOS_ABERTOS_NO_BROWSER = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)\b/i;

// ---------- Proteção contra duplo envio ----------
// Um formulário já submetido fica bloqueado (e os botões desativados) até terminarem os
// pedidos de escrita que ele lançou; assim um duplo clique não cria registos duplicados.
let escritasEmCurso = 0;
const formulariosBloqueados = new Set();

function libertarFormularios() {
  formulariosBloqueados.forEach((form) => {
    form.querySelectorAll("button[type=submit], input[type=submit]").forEach((b) => (b.disabled = false));
  });
  formulariosBloqueados.clear();
}

document.addEventListener(
  "submit",
  (evento) => {
    const form = evento.target;
    if (formulariosBloqueados.has(form)) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      return;
    }
    formulariosBloqueados.add(form);
    // desativa depois de o handler ler os campos; se não houver pedido (ex.: validação), liberta logo
    setTimeout(() => {
      form.querySelectorAll("button[type=submit], input[type=submit]").forEach((b) => (b.disabled = true));
    }, 0);
    setTimeout(() => {
      if (escritasEmCurso === 0) libertarFormularios();
    }, 800);
  },
  true
);

export async function api(path, { method = "GET", body } = {}) {
  const escrita = method !== "GET";
  if (escrita) escritasEmCurso += 1;
  try {
    return await pedirApi(path, { method, body });
  } finally {
    if (escrita) {
      escritasEmCurso -= 1;
      if (escritasEmCurso === 0) libertarFormularios();
    }
  }
}

async function pedirApi(path, { method = "GET", body } = {}) {
  const headers = { ...CABECALHOS_BASE };

  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (erroDeRede) {
    // O fetch falha aqui (em vez de devolver uma resposta HTTP) quando o
    // problema é de rede — servidor em baixo, sem ligação, CORS, etc. — e
    // não um erro "normal" da aplicação (ex.: password errada). Sem isto,
    // o erro que chega ao ecrã é a mensagem em inglês do browser (ex.:
    // "Failed to fetch"), o que confunde o utilizador.
    throw new Error("Não foi possível ligar ao servidor. Verifica se o backend está a correr e a tua ligação.");
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // Sessão expirada/inválida ou conta desativada a meio da sessão: limpa o
    // token e volta ao login. Exclui /auth/login, onde um 401 só quer dizer
    // "credenciais erradas" e a mensagem tem de ser mostrada no próprio ecrã.
    const codigo = payload?.error?.code;
    if (path !== "/auth/login") terminarSessaoSeInvalida(response.status, codigo);
    const message = payload?.error?.message || "Ocorreu um erro ao comunicar com o servidor.";
    const erro = new Error(message);
    erro.codigo = codigo; // permite à interface reagir a erros específicos (ex.: SEM_BLOCOS_LIVRES)
    throw erro;
  }

  return payload?.data;
}

// Descarrega um ficheiro protegido (precisa do token, por isso não pode ser um
// simples <a href>) e abre-o num novo separador.
export async function abrirFicheiroProtegido(path) {
  // O separador abre-se já, durante o clique: se só se abrisse depois do pedido,
  // os bloqueadores de pop-ups podiam impedi-lo.
  const janela = window.open("", "_blank");
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: CABECALHOS_BASE });
  } catch (erroDeRede) {
    janela?.close();
    throw new Error("Não foi possível ligar ao servidor. Verifica se o backend está a correr e a tua ligação.");
  }
  if (!response.ok) {
    janela?.close();
    const payload = await response.json().catch(() => null);
    terminarSessaoSeInvalida(response.status, payload?.error?.code);
    throw new Error(payload?.error?.message || "Não foi possível abrir o ficheiro.");
  }
  const blob = await response.blob();
  if (!TIPOS_ABERTOS_NO_BROWSER.test(blob.type)) {
    janela?.close();
    guardarBlob(blob, decodeURIComponent(path.split("/").pop() || "ficheiro"));
    return;
  }
  const url = URL.createObjectURL(blob);
  if (janela) janela.opener = null;
  if (janela) janela.location.href = url;
  else window.location.href = url; // pop-ups bloqueados: abre no próprio separador
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Como abrirFicheiroProtegido, mas guarda o ficheiro no computador com o nome indicado.
export async function descarregarFicheiroProtegido(path, nome) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: CABECALHOS_BASE });
  } catch (erroDeRede) {
    throw new Error("Não foi possível ligar ao servidor. Verifica se o backend está a correr e a tua ligação.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    terminarSessaoSeInvalida(response.status, payload?.error?.code);
    throw new Error(payload?.error?.message || "Não foi possível descarregar o ficheiro.");
  }
  guardarBlob(await response.blob(), nome);
}

function guardarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const ligacao = document.createElement("a");
  ligacao.href = url;
  ligacao.download = nome;
  document.body.appendChild(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
