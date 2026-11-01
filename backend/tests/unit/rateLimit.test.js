const express = require("express");
const request = require("supertest");
const { criarLimitador } = require("../../src/middleware/rateLimit");
const { errorHandler } = require("../../src/middleware/errorHandler");

function criarApp(opcoes) {
  const app = express();
  app.get("/teste", criarLimitador({ janelaMs: 60 * 1000, max: 3, ativoEmTestes: true, ...opcoes }), (req, res) =>
    res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

describe("limitador de pedidos (unitário, sem BD)", () => {
  test("deixa passar até ao máximo e devolve 429 a seguir, com Retry-After", async () => {
    const app = criarApp({ codigo: "TESTE_RATE_LIMITED" });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/teste");
      expect(res.status).toBe(200);
    }

    const bloqueado = await request(app).get("/teste");
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe("TESTE_RATE_LIMITED");
    expect(Number(bloqueado.headers["retry-after"])).toBeGreaterThan(0);
  });

  test("em testes fica desligado por omissão (não atrapalha os testes de integração)", async () => {
    const app = criarApp({ ativoEmTestes: false, max: 1 });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/teste");
      expect(res.status).toBe(200);
    }
  });
});
