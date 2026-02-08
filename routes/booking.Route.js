const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middlewares/auth");
const {
  createBooking,
  getMyBookings,
  getAvailableSlots,
  rejectBooking,
} = require("../controllers/booking.Controller");

router.post("/", protect, restrictTo("patient"), createBooking);
router.get(
  "/my-bookings",
  protect,
  restrictTo("doctor", "staff"),
  getMyBookings,
);

router.get("/slots", getAvailableSlots);

router.patch(
  "/:id/reject",
  protect,
  restrictTo("doctor", "staff"),
  rejectBooking,
);

module.exports = router;
