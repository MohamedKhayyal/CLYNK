const express = require("express");
const router = express.Router();

const clinicController = require("../controllers/clinic.controller");
const { protect, restrictTo } = require("../middlewares/auth");

router.post("/", protect, restrictTo("admin"), clinicController.createClinic);

module.exports = router;
