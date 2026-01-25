const express = require("express");
const router = express.Router();

const {
    createStaffForClinic,
    getMyClinicStaff,
} = require("../controllers/staff.Controller");

const { protect } = require("../middlewares/auth");

router.post("/", protect, createStaffForClinic);
router.get("/my-clinic", protect, getMyClinicStaff);

module.exports = router;
