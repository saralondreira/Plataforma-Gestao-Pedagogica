const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);
router.patch("/me", requireAuth, authController.updateMe);

module.exports = router;
