const express = require("express");
const authController = require("../controllers/auth.Controller");
const auth = require("../middlewares/auth");
const { authLimiter, adminLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();

router.post("/signup", authLimiter, authController.signup);
router.post("/login", authLimiter, authController.login);
router.post("/logout", auth.protect, authController.logout);

router.post(
  "/create-admin",
  auth.protect,
  auth.restrictTo("admin"),
  adminLimiter,
  authController.createAdmin,
);

module.exports = router;
