const express = require("express");
const router = express.Router();

const {
  createStaffForClinic,
  getMyClinicStaff,
  verifyStaff,
} = require("../controllers/staff.Controller");

const { protect, restrictTo } = require("../middlewares/auth");
const { isClinicOwner } = require("../middlewares/isClinicOwner");

router.post("/", createStaffForClinic);

router.use(protect, restrictTo("doctor"), isClinicOwner);

router.get("/my-clinic", getMyClinicStaff);
router.patch("/:staffId/verify", verifyStaff);

module.exports = router;
