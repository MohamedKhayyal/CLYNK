const express = require("express");
const router = express.Router();

const {
  createStaffForClinic,
  getMyClinicStaff,
} = require("../controllers/staff.Controller");

const { protect } = require("../middlewares/auth");
const { writeLimiter } = require("../middlewares/rateLimiters");

router.post("/", protect, writeLimiter, createStaffForClinic);
router.get("/my-clinic", protect, getMyClinicStaff);

module.exports = router;
