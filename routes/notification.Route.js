const express = require("express");
const auth = require("../middlewares/auth");
const notificationController = require("../controllers/notification.Controller");

const router = express.Router();

router.get("/me", auth.protect, notificationController.getMyNotifications);

router.patch("/:id/read", auth.protect, notificationController.markAsRead);

module.exports = router;
