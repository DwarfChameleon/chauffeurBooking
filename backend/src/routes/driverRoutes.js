const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware")
const { getAvailableDrivers, addDriver, getDriverDashboard, getDriverBookings, getDriverEarnings, getDriverProfile, updateDriverProfile, uploadProfilePicture, uploadDriverDocument, updateAvailability, updateLocation } = require("../controllers/driverController");
const Driver = require("../models/Driver");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "..", "uploads", "drivers");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (req, file, callback) => {
      const safeExtension = path.extname(file.originalname).toLowerCase();
      callback(null, `${req.user.id}-${Date.now()}${safeExtension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    callback(null, allowedTypes.includes(file.mimetype));
  },
});

router.get("/", auth, getAvailableDrivers);
router.get("/me/dashboard", auth, getDriverDashboard);
router.get("/me/bookings", auth, getDriverBookings);
router.get("/me/earnings", auth, getDriverEarnings);
router.get("/me/profile", auth, getDriverProfile);
router.patch("/me/profile", auth, updateDriverProfile);
router.post("/me/profile-picture", auth, upload.single("file"), uploadProfilePicture);
router.post("/me/documents/:documentKey", auth, upload.single("file"), uploadDriverDocument);
router.patch("/me/availability", auth, updateAvailability);
router.patch("/me/location", auth, updateLocation);
router.post("/", auth, addDriver);


router.post("/add", auth, adminMiddleware, async (req, res) => {
    try {
      const { name, email, phone, experience, location } = req.body;
  
      const driver = new Driver({
        name,
        email,
        phone,
        experience,
        location,
        isAvailable: true,
        user: req.user.id, // Assuming req.user is set by auth middleware
      });
  
      await driver.save();
      res.status(201).json({ message: "Driver added successfully", driver });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });
  
module.exports = router;
