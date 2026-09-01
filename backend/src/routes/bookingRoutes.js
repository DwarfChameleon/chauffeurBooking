const express = require("express");
const auth = require("../middleware/authMiddleware");
const { bookDriver, getUserBookings, acceptBooking, rejectBooking, startTrip, updateBookingDetails, markArrived, confirmDestination } = require("../controllers/bookingController");

const router = express.Router();

router.post("/", auth, bookDriver);
router.get("/", auth, getUserBookings);
router.patch("/:id/accept", auth, acceptBooking);
router.patch("/:id/reject", auth, rejectBooking);
router.patch("/:id/start", auth, startTrip);
router.patch("/:id/arrived", auth, markArrived);
router.patch("/:id/confirm-destination", auth, confirmDestination);
router.patch("/:id", auth, updateBookingDetails);

module.exports = router;
