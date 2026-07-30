const { Router } = require("express");
const turmasController = require("../controllers/turmas.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.use(requireAuth);

router.get("/", turmasController.listar);
router.post("/", turmasController.criar);
router.patch("/:id", turmasController.atualizar);
router.delete("/:id", turmasController.apagar);

module.exports = router;
