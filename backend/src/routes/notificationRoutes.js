const express = require("express");
const auth = require("../middleware/authMiddleware");
const { listNotifications, markNotificationRead, markAllNotificationsRead } = require("../controllers/notificationController");

const router = express.Router();
router.get("/", auth, listNotifications);
router.patch("/read-all", auth, markAllNotificationsRead);
router.patch("/:id/read", auth, markNotificationRead);

module.exports = router;
