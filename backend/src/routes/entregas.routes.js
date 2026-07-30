const { Router } = require("express");
const entregasController = require("../controllers/entregas.controller");
const { requireAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = Router();

router.use(requireAuth);

router.get("/", entregasController.listar);
router.get("/minhas", entregasController.listarMinhas);
router.post("/", entregasController.criar);
router.patch("/:id", entregasController.atualizar);
router.delete("/:id", entregasController.apagar);
router.patch("/:id/marcar-entregue", entregasController.marcarComoEntregue);
router.post("/:id/submeter", upload.single("ficheiro"), entregasController.submeter);
router.post("/:id/excecao", entregasController.excecao);

module.exports = router;
