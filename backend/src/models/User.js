const mongoose = require("mongoose");
const SERVICE_STATES = ["Bayelsa", "Delta", "Benin", "Rivers", "Calabar", "Abia", "Akwa Ibom", "Edo", "Abuja", "Lagos"];

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    phone: { type: String, trim: true, sparse: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "driver", "admin"], default: "user" },
    adminLevel: { type: String, enum: ["standard", "super"], default: "standard" },
    adminStatus: { type: String, enum: ["active", "deactivated"], default: "active" },
    adminVerified: { type: Boolean, default: false },
    adminVerifiedAt: { type: Date },
    adminCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    employerProfile: {
      profilePicture: { type: String, trim: true },
      accountType: { type: String, enum: ["personal", "organization", ""], default: "" },
      companyName: { type: String, trim: true },
      industry: { type: String, trim: true },
      contactPerson: { type: String, trim: true },
      emergencyContactName: { type: String, trim: true },
      emergencyContactPhone: { type: String, trim: true },
      state: { type: String, enum: [...SERVICE_STATES, ""] , default: "" },
      town: { type: String, trim: true },
      city: { type: String, trim: true },
      address: { type: String, trim: true },
      latitude: { type: Number },
      longitude: { type: Number },
      vehicleType: { type: String, enum: ["suv", "truck", "small_car", "motorcycle", "van", "bus", ""] , default: "" },
      transmission: { type: String, enum: ["automatic", "manual", "both", ""] , default: "" },
      preferredService: { type: String, enum: ["emergency_dispatch", "ride_hailing", "logistics", "chauffeur", "field_verification", ""] , default: "" },
      documents: {
        id: {
          status: { type: String, enum: ["missing", "pending", "verified", "rejected"], default: "missing" },
          reference: { type: String, trim: true },
        },
        proofOfAddress: {
          status: { type: String, enum: ["missing", "pending", "verified", "rejected"], default: "missing" },
          reference: { type: String, trim: true },
        },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
