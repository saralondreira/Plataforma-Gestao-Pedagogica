const calendarioService = require("../services/calendario.service");

async function criarLink(req, res, next) {
  try {
    const token = await calendarioService.linkDoUtilizador(req.user.id);
    const url = `${req.protocol}://${req.get("host")}/api/v1/calendario/feed.ics?t=${token}`;
    res.json({ data: { url } });
  } catch (error) {
    next(error);
  }
}

async function feed(req, res, next) {
  try {
    const ics = await calendarioService.gerarCalendario(String(req.query.t || ""));
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.send(ics);
  } catch (error) {
    next(error);
  }
}

module.exports = { criarLink, feed };
