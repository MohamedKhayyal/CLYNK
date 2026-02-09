const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middlewares/auth");
const {
  createBooking,
  getMyBookings,
  getAvailableSlots,
  cancelBooking,
} = require("../controllers/booking.Controller");

router.post("/", protect, restrictTo("patient"), createBooking);
router.get(
  "/my-bookings",
  protect,
  restrictTo("doctor", "staff", "patient"),
  getMyBookings,
);

router.get("/slots", getAvailableSlots);

router.patch(
  "/:id/reject",
  protect,
  restrictTo("doctor", "staff", "patient"),
  cancelBooking,
);

module.exports = router;
