const express = require("express");
const ratingController = require("../controllers/rating.Controller");
const { protect, restrictTo } = require("../middlewares/auth");

const router = express.Router();

router.post(
  "/doctor/:doctorId",
  protect,
  restrictTo("patient"),
  ratingController.rateDoctor,
);

router.post(
  "/clinic/:clinicId",
  protect,
  restrictTo("patient"),
  ratingController.rateClinic,
);

router.get("/doctor/:doctorId", ratingController.getDoctorRatings);
router.get("/clinic/:clinicId", ratingController.getClinicRatings);

module.exports = router;
