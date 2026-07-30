const { Router } = require("express");
const formadoresController = require("../controllers/formadores.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

router.get("/", formadoresController.listar);
router.post("/", formadoresController.criar);
router.patch("/:id", formadoresController.atualizar);
router.delete("/:id", formadoresController.apagar);

module.exports = router;
