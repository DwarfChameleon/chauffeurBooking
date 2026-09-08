require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const identifier = process.argv[2] || process.env.CHRISTIANA_ADMIN_IDENTIFIER || process.env.CHRISTIANA_ADMIN_EMAIL || process.env.CHRISTIANA_ADMIN_PHONE || "christiana";
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chauffeurBooking";

async function run() {
  await mongoose.connect(mongoUri);
  const value = String(identifier).trim();
  const user = await User.findOne({
    $or: [
      { email: value.toLowerCase() },
      { phone: value },
      { name: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ],
  });

  if (!user) {
    console.error(`No user found for "${value}". Pass email/phone/name: node src/administrator/promoteChristianaSuperAdmin.js christiana@email.com`);
    process.exitCode = 1;
    return;
  }

  user.role = "admin";
  user.adminLevel = "super";
  user.adminStatus = "active";
  user.adminVerified = true;
  user.adminVerifiedAt = user.adminVerifiedAt || new Date();
  await user.save();
  console.log(`Promoted ${user.name || user.email || user.phone} to super admin.`);
}

run()
  .catch((error) => {
    console.error("Failed to promote super admin:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
