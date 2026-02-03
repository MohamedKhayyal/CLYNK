const express = require("express");
const authController = require("../controllers/auth.Controller");
const auth = require("../middlewares/auth");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/logout", auth.protect, authController.logout);

module.exports = router;
