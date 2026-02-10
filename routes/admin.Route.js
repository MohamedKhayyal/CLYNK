const express = require("express");
const adminController = require("../controllers/admin.Controller");
const auth = require("../middlewares/auth");

const router = express.Router();

router.use(auth.protect, auth.restrictTo("admin"));

router.post("/create-admin", adminController.createAdmin);

router.get("/clinics", adminController.getClinics);
router.patch("/clinics/:id/approve", adminController.approveClinic);
router.patch("/clinics/:id/reject", adminController.rejectClinic);

router.patch("/:id/verify", adminController.verifyDoctor);
router.patch("/:id/unverify", adminController.unverifyDoctor);

router.get("/doctors", adminController.getAllDoctors);
router.get("/staff", adminController.getAllStaff);

module.exports = router;
