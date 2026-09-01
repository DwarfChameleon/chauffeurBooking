const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const User = require("../models/User");
const { createNotification, emitBookingUpdate } = require("../utils/realtime");

exports.bookDriver = async (req, res) => {
  try {
    const {
      driverId,
      date,
      pickupLocation,
      destinationLocation,
      urgency = "emergency",
      serviceType = "emergency_dispatch",
      notes,
    } = req.body;

    if (!driverId || !date) {
      return res.status(400).json({ message: "Driver and dispatch time are required" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver || !driver.isAvailable) {
      return res.status(404).json({ message: "Driver is not available" });
    }

    const employer = await User.findById(req.user.id);
    const savedLocation = employer?.employerProfile || {};
    const normalizedPickup = {
      address: pickupLocation?.address || savedLocation.address || "Pickup location pending",
      latitude: toCoordinate(pickupLocation?.latitude, savedLocation.latitude),
      longitude: toCoordinate(pickupLocation?.longitude, savedLocation.longitude),
    };

    const booking = new Booking({
      user: req.user.id,
      driver: driverId,
      date,
      pickupLocation: normalizedPickup,
      destinationLocation: normalizeLocation(destinationLocation),
      urgency,
      serviceType,
      notes,
      status: "requested",
    });

    await booking.save();
    driver.isAvailable = false;
    await driver.save();
    await createNotification({ userId: driver.user, type: "booking", title: "New booking request", body: "A chauffeur request is waiting for your response.", bookingId: booking._id });
    emitBookingUpdate(booking, "created");

    const populatedBooking = await booking.populate("driver");
    res.status(201).json(populatedBooking);
  } catch (err) {
    console.error("Booking failed:", err.message);
    res.status(500).json({ message: "Booking failed" });
  }
};

exports.acceptBooking = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user.id });
    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    const booking = await Booking.findOne({ _id: req.params.id, driver: driver._id }).populate("driver user", "name email phone profilePicture location employerProfile");
    if (!booking) return res.status(404).json({ message: "Booking request not found" });
    if (booking.status !== "requested") return res.status(409).json({ message: `Booking is already ${booking.status}` });

    booking.status = "accepted";
    booking.acceptedAt = new Date();
    await booking.save();
    driver.isAvailable = false;
    await driver.save();
    await createNotification({ userId: booking.user, type: "booking", title: "Booking accepted", body: "Your chauffeur has accepted the booking request.", bookingId: booking._id });
    emitBookingUpdate(booking, "accepted");

    res.json({ booking });
  } catch (err) {
    console.error("Accept booking failed:", err.message);
    res.status(500).json({ message: "Could not accept booking" });
  }
};

exports.rejectBooking = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user.id });
    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    const booking = await Booking.findOne({ _id: req.params.id, driver: driver._id });
    if (!booking) return res.status(404).json({ message: "Booking request not found" });
    if (booking.status !== "requested") return res.status(409).json({ message: `Booking is already ${booking.status}` });

    booking.status = "rejected";
    booking.rejectedAt = new Date();
    await booking.save();
    await createNotification({ userId: booking.user, type: "booking", title: "Booking declined", body: "The chauffeur declined your booking request.", bookingId: booking._id });
    emitBookingUpdate(booking, "rejected");

    res.json({ booking });
  } catch (err) {
    console.error("Reject booking failed:", err.message);
    res.status(500).json({ message: "Could not reject booking" });
  }
};

exports.startTrip = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user.id });
    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    const booking = await Booking.findOne({ _id: req.params.id, driver: driver._id }).populate("driver user", "name email phone profilePicture location employerProfile");
    if (!booking) return res.status(404).json({ message: "Booking request not found" });
    if (!["assigned", "accepted"].includes(booking.status)) return res.status(409).json({ message: "Only an accepted booking can be started" });

    booking.status = "started";
    booking.startedAt = new Date();
    await booking.save();
    driver.isAvailable = false;
    await driver.save();
    await createNotification({ userId: booking.user, type: "booking", title: "Trip started", body: "Your chauffeur has started the trip.", bookingId: booking._id });
    emitBookingUpdate(booking, "started");

    res.json({ booking });
  } catch (err) {
    console.error("Start trip failed:", err.message);
    res.status(500).json({ message: "Could not start trip" });
  }
};

exports.updateBookingDetails = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!["requested", "assigned", "accepted", "started", "arrived"].includes(booking.status)) {
      return res.status(409).json({ message: "Only active bookings can be updated" });
    }

    const { pickupLocation, destinationLocation, notes } = req.body;
    if (pickupLocation) {
      booking.pickupLocation = {
        ...booking.pickupLocation?.toObject?.(),
        address: typeof pickupLocation.address === "string" && pickupLocation.address.trim() ? pickupLocation.address.trim() : booking.pickupLocation?.address,
        latitude: toCoordinate(pickupLocation.latitude, booking.pickupLocation?.latitude),
        longitude: toCoordinate(pickupLocation.longitude, booking.pickupLocation?.longitude),
      };
    }
    if (destinationLocation) {
      booking.destinationLocation = {
        ...booking.destinationLocation?.toObject?.(),
        address: typeof destinationLocation.address === "string" ? destinationLocation.address.trim() : booking.destinationLocation?.address,
        latitude: toCoordinate(destinationLocation.latitude, booking.destinationLocation?.latitude),
        longitude: toCoordinate(destinationLocation.longitude, booking.destinationLocation?.longitude),
      };
    }
    if (typeof notes === "string") booking.notes = notes.trim();

    await booking.save();
    const populatedBooking = await Booking.findById(booking._id)
      .populate("user", "name email phone")
      .populate({ path: "driver", populate: { path: "user", select: "name email phone" } });
    await createNotification({
      userId: populatedBooking.driver?.user?._id || populatedBooking.driver?.user,
      type: "booking",
      title: "Booking details updated",
      body: "The employer updated the pickup, destination, or route instructions.",
      bookingId: populatedBooking._id,
    });
    emitBookingUpdate(populatedBooking, "details-updated");
    res.json({ booking: populatedBooking });
  } catch (err) {
    console.error("Booking update failed:", err.message);
    res.status(500).json({ message: "Could not update booking" });
  }
};

exports.markArrived = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user.id });
    if (!driver) return res.status(404).json({ message: "Driver profile not found" });

    const booking = await Booking.findOne({ _id: req.params.id, driver: driver._id });
    if (!booking) return res.status(404).json({ message: "Booking request not found" });
    if (booking.status !== "started") return res.status(409).json({ message: "Only a started trip can be marked as arrived" });

    booking.status = "arrived";
    booking.arrivedAt = new Date();
    await booking.save();
    await createNotification({ userId: booking.user, type: "booking", title: "Driver has arrived", body: "Your chauffeur marked arrival at the pickup point.", bookingId: booking._id });
    emitBookingUpdate(booking, "arrived");

    res.json({ booking });
  } catch (err) {
    console.error("Arrival update failed:", err.message);
    res.status(500).json({ message: "Could not mark arrival" });
  }
};

exports.confirmDestination = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "arrived") return res.status(409).json({ message: "Driver must mark arrival before destination can be confirmed" });

    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();
    const completedDriver = await Driver.findByIdAndUpdate(booking.driver, { isAvailable: true }, { new: true }).select("user");
    await createNotification({ userId: completedDriver?.user, type: "booking", title: "Trip completed", body: "The employer confirmed destination delivery.", bookingId: booking._id });
    emitBookingUpdate(booking, "completed");

    res.json({ booking });
  } catch (err) {
    console.error("Destination confirmation failed:", err.message);
    res.status(500).json({ message: "Could not confirm destination" });
  }
};

function normalizeLocation(location = {}) {
  return {
    address: typeof location.address === "string" ? location.address.trim() : "",
    latitude: toCoordinate(location.latitude),
    longitude: toCoordinate(location.longitude),
  };
}

function toCoordinate(primary, fallback) {
  const value = primary !== undefined && primary !== null && primary !== "" ? primary : fallback;
  return Number.isFinite(Number(value)) ? Number(value) : undefined;
}

exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate("driver");
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Could not retrieve bookings" });
  }
};
