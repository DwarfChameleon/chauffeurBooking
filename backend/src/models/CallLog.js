const mongoose = require("mongoose");

const CallParticipantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, enum: ["user", "driver", "admin"], required: true },
    label: { type: String, trim: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
  },
  { _id: false }
);

const CallLogSchema = new mongoose.Schema(
  {
    callSessionId: { type: String, required: true, unique: true, index: true },
    source: { type: String, enum: ["booking", "support"], required: true, index: true },
    target: { type: String, enum: ["driver", "employer", "conference", "support"], required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
    bookingLabel: { type: String, trim: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    initiatedByRole: { type: String, enum: ["user", "driver", "admin"], required: true, index: true },
    initiatedBySnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    participants: [CallParticipantSchema],
    status: {
      type: String,
      enum: ["ringing", "active", "ended", "declined", "missed", "failed"],
      default: "ringing",
      index: true,
    },
    ringStartedAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date, index: true },
    endedAt: { type: Date, index: true },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    durationSeconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

CallLogSchema.index({ createdAt: -1 });
CallLogSchema.index({ status: 1, createdAt: -1 });
CallLogSchema.index({ source: 1, createdAt: -1 });

module.exports = mongoose.model("CallLog", CallLogSchema);
