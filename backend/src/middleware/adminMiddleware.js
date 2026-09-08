const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const admin = await User.findById(req.user.id).select("role adminLevel adminStatus");
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    if (admin.adminStatus === "deactivated") {
      return res.status(403).json({ message: "This admin account is deactivated" });
    }
    req.admin = admin;
    next();
  } catch (error) {
    res.status(500).json({ message: "Could not verify admin access" });
  }
};

module.exports = adminMiddleware;
