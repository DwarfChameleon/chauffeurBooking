const express = require("express");
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const superAdmin = require("../middleware/superAdminMiddleware");
const {
  getAllUsers,
  getProfile,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  getOverview,
  deleteUser,
  getAllDrivers,
  getAllBookings,
  updateBookingStatus,
  updateDriverAvailability,
  updateDriverDocumentStatus,
  updateEmployerDocumentStatus,
  deleteDriver,
} = require("../controllers/adminController");

const router = express.Router();

router.get("/overview", auth, admin, getOverview);
router.get("/profile", auth, admin, getProfile);
router.get("/admins", auth, admin, getAdmins);
router.post("/admins", auth, admin, superAdmin, createAdmin);
router.patch("/admins/:adminId", auth, admin, superAdmin, updateAdmin);
router.delete("/admins/:adminId", auth, admin, superAdmin, deleteAdmin);
router.get("/users", auth, admin, getAllUsers);
router.delete("/users/:userId", auth, admin, deleteUser);

router.get("/drivers", auth, admin, getAllDrivers);
router.get("/bookings", auth, admin, getAllBookings);
router.patch("/bookings/:bookingId/status", auth, admin, updateBookingStatus);
router.patch("/drivers/:driverId/availability", auth, admin, updateDriverAvailability);
router.patch("/drivers/:driverId/documents/:documentKey", auth, admin, updateDriverDocumentStatus);
router.patch("/users/:userId/employer-documents/:documentKey", auth, admin, updateEmployerDocumentStatus);
router.delete("/drivers/:driverId", auth, admin, deleteDriver);

module.exports = router;
