const express = require("express");
const router = express.Router();

const {
  createClinic,
  getPublicClinics,
} = require("../controllers/clinic.Controller");

const { protect, restrictTo } = require("../middlewares/auth");
const { isVerifiedDoctor } = require("../middlewares/isVerifiedDoctor");

router.post("/", protect, restrictTo("doctor"), isVerifiedDoctor, createClinic);
router.get("/", getPublicClinics);

module.exports = router;
