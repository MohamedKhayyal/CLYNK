const express = require("express");
const router = express.Router();

const {
  createStaffForClinic,
  getMyClinicStaff,
  verifyStaff,
  getPendingStaff,
} = require("../controllers/staff.Controller");

const { protect, restrictTo } = require("../middlewares/auth");
const { isClinicOwner } = require("../middlewares/isClinicOwner");

router.use(protect, restrictTo("doctor"), isClinicOwner);
router.post("/create", createStaffForClinic);
router.get("/pending", getPendingStaff);
router.get("/my-clinic", getMyClinicStaff);
router.patch("/:staffId/verify", verifyStaff);

module.exports = router;
