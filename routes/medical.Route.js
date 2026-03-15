const express = require("express");
const router = express.Router();

const { protect, restrictTo } = require("../middlewares/auth");
const {
  getMyMedicalProfile,
  upsertMyMedicalProfile,
  approveDoctorAccess,
  revokeDoctorAccess,
  getPatientMedicalProfile,
  createPrescription,
  updatePrescription,
} = require("../controllers/medical.Controller");

router.use(protect);

router.get("/me", restrictTo("patient"), getMyMedicalProfile);
router.patch("/me", restrictTo("patient"), upsertMyMedicalProfile);
router.post("/consents", restrictTo("patient"), approveDoctorAccess);
router.patch("/consents/:id/revoke", restrictTo("patient"), revokeDoctorAccess);

router.get(
  "/patients/:patientUserId",
  restrictTo("doctor", "staff"),
  getPatientMedicalProfile,
);

router.post(
  "/prescriptions",
  restrictTo("doctor", "staff"),
  createPrescription,
);

router.patch(
  "/prescriptions/:id",
  restrictTo("doctor", "staff"),
  updatePrescription,
);

module.exports = router;
