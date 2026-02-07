const express = require("express");
const authController = require("../controllers/auth.Controller");
const auth = require("../middlewares/auth");
const {
  signupValidation,
  loginValidation,
  refreshValidation,
} = require("../middlewares/auth.Validation");

const router = express.Router();

router.post("/signup", signupValidation, authController.signup);
router.post("/login", loginValidation, authController.login);

router.post("/refresh", refreshValidation, authController.refreshToken);

router.post("/logout", auth.protect, authController.logout);

module.exports = router;
