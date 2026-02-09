const express = require("express");
const router = express.Router();

const { getDoctors, getDoctorProfile, getDoctorDashboard } = require("../controllers/doctor.Controller");
const { protect, restrictTo } = require("../middlewares/auth");

router.get("/", getDoctors);

router.get(
    "/:id/profile",
    getDoctorProfile
);

router.get("/dashboard", protect, restrictTo("doctor"), getDoctorDashboard);

module.exports = router;
