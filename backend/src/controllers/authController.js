const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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
  user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
});

const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.verify(token, secret);
};

exports.register = async (req, res) => {
  try {
    const { contact, method, role, location, password, name, phone, employerType } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!contact) return res.status(400).json({ message: "Contact is required" });
    if (!method || !["email", "phone"].includes(method)) {
      return res.status(400).json({ message: "Registration method must be email or phone" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!["user", "driver", "admin"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    if (!location) return res.status(400).json({ message: "Location is required" });

    let parsedLocation;
    try {
      parsedLocation = JSON.parse(location);
    } catch (error) {
      return res.status(400).json({ message: "Location must be valid JSON" });
    }

    const userEmail = method === "email" ? contact.toLowerCase().trim() : undefined;
    const phoneInput = method === "phone" ? contact : phone;
    const userPhone = phoneInput ? normalizeNigeriaPhone(phoneInput) : undefined;
    if (userPhone && !isValidNigeriaPhone(userPhone)) {
      return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    }
    const duplicateConditions = [];
    if (userEmail) duplicateConditions.push({ email: userEmail });
    if (userPhone) duplicateConditions.push({ phone: userPhone });

    let user = await User.findOne({ $or: duplicateConditions });
    if (user) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
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
    res.status(500).json({ message: "Server error" });
  }
};


exports.login = async (req, res) => {
  try {
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
    res.status(500).json({ message: "Server error" });
  }
};

exports.refresh = async (req, res) => {
  try {
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
