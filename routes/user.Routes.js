const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const userController = require("../controllers/user.controller");

router.get("/me", auth.protect, userController.getMe);
router.patch("/me", auth.protect, userController.updateMe);

module.exports = router;
