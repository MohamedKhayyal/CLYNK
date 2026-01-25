const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middlewares/auth");
const { verifyDoctor } = require("../controllers/admin.Doctor.Controller");
const { getDoctors } = require("../controllers/doctor.Controller");

router.patch("/:id/verify", protect, restrictTo("admin"), verifyDoctor);

router.get("/", getDoctors);
module.exports = router;
