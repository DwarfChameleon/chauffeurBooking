const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    date: { type: Date, required: true },
    pickupLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, trim: true },
    },
    destinationLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, trim: true },
    },
    urgency: { type: String, enum: ["standard", "urgent", "emergency"], default: "standard" },
    serviceType: {
      type: String,
      enum: ["emergency_dispatch", "ride_hailing", "logistics", "chauffeur", "field_verification"],
      default: "emergency_dispatch",
    },
    notes: { type: String },
    status: {
      type: String,
      enum: ["requested", "assigned", "accepted", "started", "rejected", "arrived", "completed", "cancelled"],
      default: "requested",
    },
    acceptedAt: { type: Date },
    startedAt: { type: Date },
    rejectedAt: { type: Date },
    arrivedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", BookingSchema);
