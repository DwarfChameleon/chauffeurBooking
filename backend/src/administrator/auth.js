const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { normalizeNigeriaPhone } = require("../utils/nigeriaPhone");
const { serializeAdminProfile } = require("./workspace");

const LOGIN_AGAIN_MESSAGE = "Please log in again to continue.";

function signToken(user) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "30m" });
}

function signRefreshToken(user) {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ id: user._id, role: user.role, type: "refresh" }, secret, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" });
}

function serializeAdminSession(user) {
  return {
    token: signToken(user),
    refreshToken: signRefreshToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      adminLevel: user.adminLevel || "standard",
      adminStatus: user.adminStatus || "active",
    },
    profile: serializeAdminProfile(user),
  };
}

exports.login = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not ready. Please try again in a moment." });
    }

    const { email, phone, contact, password } = req.body;
    const identifier = email || phone || contact;
    if (!identifier || !password) return res.status(400).json({ message: "Admin email/phone and password are required" });

    const cleanIdentifier = identifier.trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier.toLowerCase() }, { phone: normalizeNigeriaPhone(cleanIdentifier) }],
    });
    if (!user || user.role !== "admin") return res.status(400).json({ message: "Invalid admin credentials" });
    if (user.adminStatus === "deactivated") return res.status(403).json({ message: "This admin account is deactivated" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid admin credentials" });

    res.json(serializeAdminSession(user));
  } catch (error) {
    console.error("Admin login error:", { message: error.message, name: error.name });
    res.status(500).json({ message: "Admin login failed" });
  }
};

exports.LOGIN_AGAIN_MESSAGE = LOGIN_AGAIN_MESSAGE;
