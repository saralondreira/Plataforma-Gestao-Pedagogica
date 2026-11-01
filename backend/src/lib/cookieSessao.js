// Sessão do browser: o JWT vai num cookie httpOnly (o JavaScript da página nunca o lê, por isso um XSS
// não o consegue roubar). O cookie é enviado automaticamente pelo browser, o que abre a porta a CSRF;
// por isso, nos pedidos que alteram dados, exige-se (a) o cabeçalho X-Requested-With, que outro site não
// consegue enviar sem pré-verificação CORS, e (b) que o Origin, se existir, seja o da aplicação.
// Clientes de API (testes, scripts) continuam a poder usar "Authorization: Bearer".
const NOME_COOKIE = "pedagogica_sessao";
const CABECALHO_CSRF = "x-requested-with";
const VALOR_CSRF = "pedagogica";
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000; // igual à validade do JWT

function opcoesDoCookie() {
  const sameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase(); // "none" só se o frontend estiver noutro site (exige HTTPS)
  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    path: "/",
  };
}

function guardarSessao(res, token) {
  res.cookie(NOME_COOKIE, token, { ...opcoesDoCookie(), maxAge: SETE_DIAS_MS });
}

function limparSessao(res) {
  res.clearCookie(NOME_COOKIE, opcoesDoCookie());
}

function lerCookie(req, nome = NOME_COOKIE) {
  for (const par of String(req.headers.cookie || "").split(";")) {
    const i = par.indexOf("=");
    if (i < 0 || par.slice(0, i).trim() !== nome) continue;
    try {
      return decodeURIComponent(par.slice(i + 1).trim());
    } catch (erro) {
      return null;
    }
  }
  return null;
}

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

// Devolve true se um pedido autenticado por cookie passa as verificações anti-CSRF.
function pedidoPorCookieEValido(req) {
  const origem = req.headers.origin;
  const permitida = process.env.CORS_ORIGIN || "http://localhost:5500";
  if (origem && origem !== permitida) return false;
  if (METODOS_SEGUROS.has(req.method)) return true;
  return req.headers[CABECALHO_CSRF] === VALOR_CSRF;
}

module.exports = { NOME_COOKIE, VALOR_CSRF, guardarSessao, limparSessao, lerCookie, pedidoPorCookieEValido };
