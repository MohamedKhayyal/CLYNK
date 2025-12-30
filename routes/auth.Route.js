const express = require("express");
const { uploadSingle, uploadFields, resize } = require("../middlewares/upload");

const auth = require("../middlewares/auth");

const router = express.Router();



module.exports = router;
