const express = require("express");
const { uploadSingle, uploadFields, resize } = require("../middlewares/upload");
const authController = require("../controllers/auth.Controller");
const auth = require("../middlewares/auth");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post(
  "/create-admin",
  auth.protect,
  auth.restrictTo("admin"),
  authController.createAdmin
);

module.exports = router;
