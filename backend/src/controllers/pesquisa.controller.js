const pesquisaService = require("../services/pesquisa.service");

async function pesquisar(req, res, next) {
  try {
    res.json({ data: await pesquisaService.pesquisar(req.query.q) });
  } catch (error) {
    next(error);
  }
}

module.exports = { pesquisar };
