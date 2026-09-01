// models/driver.js
const mongoose = require("mongoose");
const SERVICE_STATES = ["Bayelsa", "Delta", "Benin", "Rivers", "Calabar", "Abia", "Akwa Ibom", "Edo", "Abuja", "Lagos"];

const DriverSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  experience: { type: Number, required: true, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: null },
  profilePicture: { type: String, trim: true },
  licenseNumber: { type: String, trim: true },
  licenseYear: { type: Number },
  personalInformation: {
    address: { type: String, trim: true },
    dateOfBirth: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
  },
  routeExperience: [{
    state: { type: String, enum: SERVICE_STATES, required: true },
    routes: { type: String, trim: true },
    years: { type: Number, default: 0 },
  }],
  vehicle: {
    transmission: { type: String, enum: ["automatic", "manual", "both", ""], default: "" },
    type: { type: String, enum: ["all", "suv_small_cars", "suv", "truck", "small_car", "motorcycle", "van", "bus", ""], default: "" },
    plateNumber: { type: String, trim: true },
    model: { type: String, trim: true },
  },
  documents: {
    id: {
      status: { type: String, enum: ["missing", "pending", "verified", "rejected"], default: "missing" },
      reference: { type: String, trim: true },
    },
    driversLicense: {
      status: { type: String, enum: ["missing", "pending", "verified", "rejected"], default: "missing" },
      reference: { type: String, trim: true },
    },
    proofOfAddress: {
      status: { type: String, enum: ["missing", "pending", "verified", "rejected"], default: "missing" },
      reference: { type: String, trim: true },
    },
  },
  location: { type: String },
  currentState: { type: String, enum: [...SERVICE_STATES, ""], default: "" },
  isAvailable: { type: Boolean, default: true },
  verificationPhoto: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Driver", DriverSchema);
