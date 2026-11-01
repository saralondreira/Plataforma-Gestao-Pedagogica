const { AppError } = require("../utils/AppError");

// Limitador de pedidos por IP, em memória (janela fixa). Sem dependências
// externas — suficiente para uma instância única (este projeto); se a API
// passar a correr em várias instâncias, trocar por um store partilhado (ex.:
// Redis). Em testes (NODE_ENV=test) fica desligado, porque os testes de
// integração fazem muitos logins/pedidos seguidos a partir do mesmo IP —
// `ativoEmTestes: true` liga-o à mesma (usado no próprio teste do limitador).
function criarLimitador({ janelaMs, max, codigo = "RATE_LIMITED", mensagem, ativoEmTestes = false }) {
  const contagens = new Map(); // ip -> { total, expiraEm }

  const limpeza = setInterval(() => {
    const agora = Date.now();
    for (const [ip, registo] of contagens) {
      if (registo.expiraEm <= agora) contagens.delete(ip);
    }
  }, janelaMs);
  limpeza.unref(); // não impede o processo (ex.: Jest) de terminar

  return function limitador(req, res, next) {
    if (process.env.NODE_ENV === "test" && !ativoEmTestes) return next();

    const ip = req.ip || req.socket?.remoteAddress || "desconhecido";
    const agora = Date.now();
    let registo = contagens.get(ip);

    if (!registo || registo.expiraEm <= agora) {
      registo = { total: 0, expiraEm: agora + janelaMs };
      contagens.set(ip, registo);
    }

    registo.total += 1;

    if (registo.total > max) {
      res.set("Retry-After", String(Math.ceil((registo.expiraEm - agora) / 1000)));
      return next(
        new AppError(429, codigo, mensagem || "Demasiados pedidos — tenta outra vez dentro de alguns minutos.")
      );
    }

    next();
  };
}

// Login: trava força bruta de passwords. 10 tentativas por IP em 15 minutos.
const limitadorLogin = criarLimitador({
  janelaMs: 15 * 60 * 1000,
  max: 10,
  codigo: "LOGIN_RATE_LIMITED",
  mensagem: "Demasiadas tentativas de login — tenta outra vez dentro de 15 minutos.",
});

// Pedido de Acesso é público (sem autenticação): limita spam/preenchimento
// automático. 5 pedidos por IP por hora.
const limitadorPedidosAcesso = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 5,
  codigo: "PEDIDOS_RATE_LIMITED",
  mensagem: "Já enviaste vários pedidos de acesso — tenta outra vez mais tarde.",
});

// Feed de calendário (público, protegido por token): os clientes de calendário
// pedem de tempos a tempos; 120 por hora por IP chega e trava tentativas de adivinhar tokens.
const limitadorCalendario = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 120,
  codigo: "CALENDARIO_RATE_LIMITED",
  mensagem: "Demasiados pedidos ao calendário — tenta outra vez mais tarde.",
});

// Recuperação de palavra-passe (pública, envia emails): 5 pedidos por IP por hora.
const limitadorRecuperacao = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 5,
  codigo: "RECUPERACAO_RATE_LIMITED",
  mensagem: "Demasiados pedidos de recuperação — tenta outra vez mais tarde.",
});

// Quem pede a ligação e quem a usa não partilham contador: cinco pedidos numa rede partilhada
// não podem impedir uma pessoa de redefinir a palavra-passe com uma ligação válida.
const limitadorRedefinicao = criarLimitador({
  janelaMs: 60 * 60 * 1000,
  max: 10,
  codigo: "RECUPERACAO_RATE_LIMITED",
  mensagem: "Demasiadas tentativas — tenta outra vez mais tarde.",
});

module.exports = { criarLimitador, limitadorRecuperacao, limitadorRedefinicao, limitadorLogin, limitadorPedidosAcesso, limitadorCalendario };
