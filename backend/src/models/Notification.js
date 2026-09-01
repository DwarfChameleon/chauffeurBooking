const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["booking", "verification", "account", "system"], default: "system" },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
