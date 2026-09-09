const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Driver = require("../models/Driver");
const { NIGERIA_PHONE_ERROR, isValidNigeriaPhone, normalizeNigeriaPhone } = require("../utils/nigeriaPhone");

const normalizeRole = (role) => (role === "service_user" ? "user" : role);

const signToken = (user) => {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "30m" });
};

const signRefreshToken = (user) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ id: user._id, role: user.role, type: "refresh" }, secret, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d" });
};

const serializeAuthSession = (user) => ({
  token: signToken(user),
  refreshToken: signRefreshToken(user),
  user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, adminLevel: user.adminLevel, adminStatus: user.adminStatus },
});

const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.verify(token, secret);
};

const signPasswordResetToken = (user) => {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ id: user._id, type: "password-reset" }, secret, { expiresIn: "15m" });
};

const databaseUnavailable = (res) => res.status(503).json({ message: "Database connection is not ready. Please try again in a moment." });

const phonesMatch = (left, right) => normalizeNigeriaPhone(left || "") === normalizeNigeriaPhone(right || "");

exports.register = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { contact, method, role, location, password, name, email, phone, employerType } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!contact) return res.status(400).json({ message: "Contact is required" });
    if (!method || !["email", "phone"].includes(method)) {
      return res.status(400).json({ message: "Registration method must be email or phone" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!["user", "driver"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (!location) return res.status(400).json({ message: "Location is required" });

    let parsedLocation;
    try {
      parsedLocation = JSON.parse(location);
    } catch (error) {
      return res.status(400).json({ message: "Location must be valid JSON" });
    }

    const emailInput = method === "email" ? contact : email;
    const userEmail = emailInput ? emailInput.toLowerCase().trim() : undefined;
    const phoneInput = method === "phone" ? contact : phone;
    const userPhone = phoneInput ? normalizeNigeriaPhone(phoneInput) : undefined;
    if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (userPhone && !isValidNigeriaPhone(userPhone)) {
      return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    }
    if (!userEmail && !userPhone) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    const duplicateConditions = [];
    if (userEmail) duplicateConditions.push({ email: userEmail });
    if (userPhone) duplicateConditions.push({ phone: userPhone });

    const existingUsers = await User.find({ $or: duplicateConditions }).select("email phone").lean();
    if (existingUsers.some((existingUser) => existingUser.email && existingUser.email === userEmail)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    if (existingUsers.some((existingUser) => existingUser.phone && existingUser.phone === userPhone)) {
      return res.status(409).json({ message: "An account with this phone number already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name: name || contact,
      email: userEmail,
      phone: userPhone,
      password: hashedPassword,
      role: normalizedRole,
      employerProfile: normalizedRole === "user" ? { accountType: ["personal", "organization"].includes(employerType) ? employerType : "personal" } : undefined,
    });
    await user.save();

    if (normalizedRole === "driver") {
      const driver = new Driver({
        name: name || contact,
        email: userEmail,
        phone: userPhone,
        experience: 0,
        location: `${parsedLocation.latitude}, ${parsedLocation.longitude}`,
        isAvailable: true,
        verificationPhoto: req.file ? req.file.originalname : undefined,
        user: user._id,
      });
      await driver.save();
    }

    res.status(201).json(serializeAuthSession(user));
  } catch (error) {
    console.error("Registration error:", error);
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
      const label = field === "phone" ? "phone number" : "email";
      return res.status(409).json({ message: `An account with this ${label} already exists.` });
    }
    res.status(500).json({ message: "Server error" });
  }
};


exports.login = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { email, phone, contact, password } = req.body;
    const identifier = email || phone || contact;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Contact and password are required" });
    }

    const cleanIdentifier = identifier.trim();
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier.toLowerCase() }, { phone: normalizeNigeriaPhone(cleanIdentifier) }],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    res.json(serializeAuthSession(user));
  } catch (error) {
    console.error("Login error:", { message: error.message, name: error.name });
    res.status(500).json({ message: "Server error" });
  }
};

exports.refresh = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: "Please log in again to continue." });

    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.type !== "refresh") return res.status(401).json({ message: "Please log in again to continue." });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Please log in again to continue." });

    res.json(serializeAuthSession(user));
  } catch {
    res.status(401).json({ message: "Please log in again to continue." });
  }
};

exports.verifyForgotPassword = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { email, phone, emergencyContact, emergencyContactPhone } = req.body;
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = normalizeNigeriaPhone(phone || "");
    const cleanEmergencyPhone = normalizeNigeriaPhone(emergencyContactPhone || emergencyContact || "");

    if (!cleanEmail || !cleanPhone || !cleanEmergencyPhone) {
      return res.status(400).json({ message: "Email, phone number, and emergency contact phone are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (!isValidNigeriaPhone(cleanPhone) || !isValidNigeriaPhone(cleanEmergencyPhone)) {
      return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    }

    const user = await User.findOne({ email: cleanEmail, phone: cleanPhone });
    if (!user) {
      return res.status(400).json({ message: "We could not verify those account details." });
    }

    const emergencyPhones = [user.employerProfile?.emergencyContactPhone].filter(Boolean);
    if (user.role === "driver") {
      const driver = await Driver.findOne({ user: user._id }).select("emergencyContactPhone").lean();
      if (driver?.emergencyContactPhone) emergencyPhones.push(driver.emergencyContactPhone);
    }

    if (!emergencyPhones.some((savedPhone) => phonesMatch(savedPhone, cleanEmergencyPhone))) {
      return res.status(400).json({ message: "Emergency contact does not match this account." });
    }

    res.json({
      resetToken: signPasswordResetToken(user),
      message: "Account verified. You can now set a new password.",
    });
  } catch (error) {
    console.error("Forgot password verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetForgotPassword = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { resetToken, password } = req.body;
    if (!resetToken) return res.status(400).json({ message: "Password reset token is required." });
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const secret = process.env.JWT_SECRET || "dev-secret-change-me";
    const decoded = jwt.verify(resetToken, secret);
    if (decoded.type !== "password-reset") {
      return res.status(400).json({ message: "Invalid password reset token." });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "Account not found." });

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: "Password changed successfully. You can now sign in." });
  } catch (error) {
    const expired = error?.name === "TokenExpiredError" || error?.name === "JsonWebTokenError";
    res.status(expired ? 400 : 500).json({ message: expired ? "Password reset session has expired. Please verify your details again." : "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Account not found." });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
