const express = require("express");
const router = express.Router();

const { getDoctors } = require("../controllers/doctor.Controller");

router.get("/", getDoctors);

module.exports = router;
