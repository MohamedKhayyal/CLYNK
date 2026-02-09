const express = require("express");
const router = express.Router();

const {
  createClinic,
  getPublicClinics,
  getActiveClinicStaff,
  getClinicProfile,
  getClinicStats,
} = require("../controllers/clinic.Controller");

const { protect, restrictTo } = require("../middlewares/auth");
const { isVerifiedDoctor } = require("../middlewares/isVerifiedDoctor");
const { isClinicOwner } = require("../middlewares/isClinicOwner");

router.post("/", protect, restrictTo("doctor"), isVerifiedDoctor, createClinic);
router.get("/", getPublicClinics);
router.get("/:clinicId/staff", getActiveClinicStaff);
router.get("/:id/profile", getClinicProfile);
router.get("/my-stats", protect, isClinicOwner, getClinicStats);

module.exports = router;
