const mongoose = require("mongoose");

const SUPPORT_CATEGORIES = [
  "booking_issue",
  "payment_issue",
  "account_login",
  "driver_verification",
  "safety_concern",
  "app_bug",
  "other",
];

const SupportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "driver", "admin"], required: true, index: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    bookingReference: { type: String, trim: true, maxlength: 80 },
    priority: { type: String, enum: ["normal", "high", "urgent"], default: "normal", index: true },
    status: { type: String, enum: ["open", "in_review", "resolved", "closed"], default: "open", index: true },
    contactSnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ user: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);
