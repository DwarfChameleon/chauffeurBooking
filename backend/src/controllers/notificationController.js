const Notification = require("../models/Notification");
const { serializeNotification } = require("../utils/realtime");

exports.listNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = notifications.filter((notification) => !notification.readAt).length;
    res.json({ notifications: notifications.map(serializeNotification), unreadCount });
  } catch (error) {
    console.error("Notifications failed:", error.message);
    res.status(500).json({ message: "Could not load notifications" });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification: serializeNotification(notification) });
  } catch (error) {
    res.status(500).json({ message: "Could not update notification" });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Could not update notifications" });
  }
};
