const express = require("express");

const { protect, restrictTo } = require("../middlewares/auth");
const {
  requestPrescriptionAccess,
  respondToPrescriptionAccess,
  createPrescription,
  getMyPrescriptions,
  getPrescriptionById,
} = require("../controllers/prescription.Controller");

const router = express.Router();

router.post(
  "/bookings/:bookingId/request-access",
  protect,
  restrictTo("doctor", "staff"),
  requestPrescriptionAccess,
);

router.patch(
  "/bookings/:bookingId/access",
  protect,
  restrictTo("patient"),
  respondToPrescriptionAccess,
);

router.post(
  "/bookings/:bookingId",
  protect,
  restrictTo("doctor", "staff"),
  createPrescription,
);

router.get(
  "/my-prescriptions",
  protect,
  restrictTo("doctor", "staff", "patient"),
  getMyPrescriptions,
);

router.get(
  "/:id",
  protect,
  restrictTo("doctor", "staff", "patient"),
  getPrescriptionById,
);

module.exports = router;
