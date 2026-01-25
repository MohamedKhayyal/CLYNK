const express = require("express");
const router = express.Router();

const {
  getClinics,
  approveClinic,
} = require("../controllers/admin.Clinic.Controller");

const { protect, restrictTo } = require("../middlewares/auth");
const { adminLimiter } = require("../middlewares/rateLimiters");

router.use(protect, restrictTo("admin"), adminLimiter);

router.get("/clinics", getClinics);
router.patch("/clinics/:id/approve", approveClinic);

module.exports = router;
