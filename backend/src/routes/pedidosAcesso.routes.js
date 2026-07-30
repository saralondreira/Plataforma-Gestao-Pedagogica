const { Router } = require("express");
const pedidosAcessoController = require("../controllers/pedidosAcesso.controller");

const router = Router();

// Rota pública: pedido de acesso é preenchido antes de existir qualquer conta.
router.post("/", pedidosAcessoController.criar);

module.exports = router;
