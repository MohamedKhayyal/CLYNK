const express = require("express");
const router = express.Router();

const { createStaffForClinic } = require("../controllers/staff.Controller");
const { protect } = require("../middlewares/auth");
const { isClinicOwner } = require("../middlewares/isClinicOwner");

router.post("/:id/staff", protect, isClinicOwner, createStaffForClinic);

module.exports = router;
