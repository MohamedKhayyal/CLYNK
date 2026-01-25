const express = require("express");
const router = express.Router();

const {
  getClinics,
  approveClinic,
} = require("../controllers/admin.Clinic.Controller");

const { protect, restrictTo } = require("../middlewares/auth");

router.use(protect, restrictTo("admin"));

router.get("/clinics", getClinics);
router.patch("/clinics/:id/approve", approveClinic);

module.exports = router;
