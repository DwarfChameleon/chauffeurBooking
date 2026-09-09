const User = require("../models/User");
const Driver = require("../models/Driver");
const Booking = require("../models/Booking");
const bcrypt = require("bcryptjs");
const { createNotification, emitBookingUpdate } = require("../utils/realtime");
const { serializeAdminProfile } = require("../administrator/workspace");
const { NIGERIA_PHONE_ERROR, isValidNigeriaPhone, normalizeNigeriaPhone } = require("../utils/nigeriaPhone");

const DOCUMENT_KEYS = ["id", "driversLicense", "proofOfAddress"];
const EMPLOYER_DOCUMENT_KEYS = ["id", "proofOfAddress"];
const DOCUMENT_STATUSES = ["missing", "pending", "verified", "rejected"];
const ACTIVE_BOOKING_STATUSES = ["requested", "assigned", "accepted", "started", "arrived"];
const LIVE_TRIP_STATUSES = ["started", "arrived"];
const ADMIN_STATUSES = ["active", "deactivated"];
const ADMIN_LEVELS = ["standard", "super"];

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to get users" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user || user.role !== "admin") return res.status(404).json({ message: "Admin profile not found" });
    res.json({ profile: serializeAdminProfile(user) });
  } catch (err) {
    console.error("Admin profile failed:", err.message);
    res.status(500).json({ message: "Failed to load admin profile" });
  }
};

exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" }).select("-password").sort({ adminLevel: -1, createdAt: -1 });
    res.json({ admins: admins.map(serializeAdminUser), canManageAdmins: req.admin?.adminLevel === "super" });
  } catch (err) {
    res.status(500).json({ message: "Failed to load admins" });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, adminLevel = "standard" } = req.body;
    const cleanEmail = cleanString(email).toLowerCase();
    const cleanPhone = normalizeNigeriaPhone(phone);
    if (!name || (!cleanEmail && !cleanPhone)) return res.status(400).json({ message: "Admin name and email or phone are required" });
    if (cleanPhone && !isValidNigeriaPhone(cleanPhone)) return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (!ADMIN_LEVELS.includes(adminLevel)) return res.status(400).json({ message: "Invalid admin level" });

    const duplicateConditions = [];
    if (cleanEmail) duplicateConditions.push({ email: cleanEmail });
    if (cleanPhone) duplicateConditions.push({ phone: cleanPhone });
    const existing = duplicateConditions.length ? await User.findOne({ $or: duplicateConditions }) : null;
    if (existing) return res.status(400).json({ message: "An account with this email or phone already exists" });

    const admin = await User.create({
      name: cleanString(name),
      email: cleanEmail || undefined,
      phone: cleanPhone || undefined,
      password: await bcrypt.hash(password, 10),
      role: "admin",
      adminLevel,
      adminStatus: "active",
      adminVerified: true,
      adminVerifiedAt: new Date(),
      adminCreatedBy: req.user.id,
    });
    res.status(201).json({ admin: serializeAdminUser(admin) });
  } catch (err) {
    console.error("Create admin failed:", err.message);
    res.status(500).json({ message: "Failed to create admin" });
  }
};

exports.updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { adminLevel, adminStatus, adminVerified, role } = req.body;
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") return res.status(404).json({ message: "Admin not found" });

    const isSelf = String(admin._id) === String(req.user.id);
    if (isSelf && (adminLevel === "standard" || adminStatus === "deactivated" || role !== undefined)) {
      return res.status(400).json({ message: "You cannot demote, deactivate, or change the role of your own admin account" });
    }

    if (adminLevel !== undefined) {
      if (!ADMIN_LEVELS.includes(adminLevel)) return res.status(400).json({ message: "Invalid admin level" });
      admin.adminLevel = adminLevel;
    }
    if (adminStatus !== undefined) {
      if (!ADMIN_STATUSES.includes(adminStatus)) return res.status(400).json({ message: "Invalid admin status" });
      admin.adminStatus = adminStatus;
    }
    if (adminVerified !== undefined) {
      admin.adminVerified = Boolean(adminVerified);
      admin.adminVerifiedAt = admin.adminVerified ? new Date() : undefined;
      if (admin.adminVerified) admin.adminStatus = "active";
    }
    if (role !== undefined) {
      if (!["user", "driver", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
      admin.role = role;
      if (role !== "admin") {
        admin.adminLevel = "standard";
        admin.adminStatus = "active";
        admin.adminVerified = false;
        admin.adminVerifiedAt = undefined;
      }
    }

    await admin.save();
    res.json({ admin: serializeAdminUser(admin) });
  } catch (err) {
    console.error("Update admin failed:", err.message);
    res.status(500).json({ message: "Failed to update admin" });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    if (String(adminId) === String(req.user.id)) return res.status(400).json({ message: "You cannot delete your own admin account" });
    const admin = await User.findOneAndDelete({ _id: adminId, role: "admin" });
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json({ message: "Admin deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete admin" });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const [users, drivers, bookings] = await Promise.all([
      User.find().select("-password").sort({ createdAt: -1 }),
      Driver.find().populate("user", "name email phone role").sort({ createdAt: -1 }),
      Booking.find().populate("user", "name email phone").populate({ path: "driver", populate: { path: "user", select: "name email phone" } }).sort({ createdAt: -1 }),
    ]);

    const employers = users.filter((user) => user.role === "user");
    const activeBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status));
    const pendingDriverDocuments = drivers.reduce((count, driver) => count + DOCUMENT_KEYS.filter((key) => driver.documents?.[key]?.status === "pending").length, 0);
    const pendingEmployerDocuments = employers.reduce((count, employer) => count + EMPLOYER_DOCUMENT_KEYS.filter((key) => employer.employerProfile?.documents?.[key]?.status === "pending").length, 0);

    res.json({
      summary: {
        users: users.length,
        employers: employers.length,
        drivers: drivers.length,
        admins: users.filter((user) => user.role === "admin").length,
        bookings: bookings.length,
        activeBookings: activeBookings.length,
        liveTrips: bookings.filter((booking) => booking.status === "started").length,
        completedBookings: bookings.filter((booking) => booking.status === "completed").length,
        cancelledBookings: bookings.filter((booking) => booking.status === "cancelled").length,
        availableDrivers: drivers.filter((driver) => driver.isAvailable).length,
        pendingDocuments: pendingDriverDocuments + pendingEmployerDocuments,
      },
      recentBookings: bookings.slice(0, 8).map(serializeBooking),
      verificationQueue: {
        drivers: drivers.filter((driver) => DOCUMENT_KEYS.some((key) => driver.documents?.[key]?.status === "pending")).map(serializeDriver),
        employers: employers.filter((employer) => EMPLOYER_DOCUMENT_KEYS.some((key) => employer.employerProfile?.documents?.[key]?.status === "pending")).map(serializeUser),
      },
      notifications: buildAdminNotifications(activeBookings, pendingDriverDocuments, pendingEmployerDocuments, drivers),
    });
  } catch (err) {
    console.error("Admin overview failed:", err.message);
    res.status(500).json({ message: "Failed to load admin overview" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      if (req.admin?.adminLevel !== "super") return res.status(403).json({ message: "Only a super admin can delete an admin account" });
      if (String(user._id) === String(req.user.id)) return res.status(400).json({ message: "You cannot delete your own admin account" });
    }
    await User.findByIdAndDelete(userId);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
};

exports.getAllDrivers = async (req, res) => {
  try {
    const [drivers, liveBookings] = await Promise.all([
      Driver.find().populate("user", "name email phone role").sort({ createdAt: -1 }),
      Booking.find({ status: { $in: LIVE_TRIP_STATUSES } }).select("driver status startedAt arrivedAt updatedAt").lean(),
    ]);
    const liveTripsByDriver = new Map(liveBookings.map((booking) => [String(booking.driver), booking]));
    res.json(drivers.map((driver) => serializeDriver(driver, liveTripsByDriver.get(String(driver._id)))));
  } catch (err) {
    res.status(500).json({ message: "Failed to get drivers" });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate("user", "name email phone").populate({ path: "driver", populate: { path: "user", select: "name email phone" } }).sort({ createdAt: -1 });
    res.json(bookings.map(serializeBooking));
  } catch (err) {
    res.status(500).json({ message: "Failed to get bookings" });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    if (!["requested", "assigned", "accepted", "started", "rejected", "arrived", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid booking status" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.status = status;
    if ((status === "assigned" || status === "accepted") && !booking.acceptedAt) booking.acceptedAt = new Date();
    if (status === "started" && !booking.startedAt) booking.startedAt = new Date();
    if (status === "rejected" && !booking.rejectedAt) booking.rejectedAt = new Date();
    if (status === "arrived" && !booking.arrivedAt) booking.arrivedAt = new Date();
    if (status === "completed" && !booking.completedAt) booking.completedAt = new Date();
    await booking.save();

    if (["completed", "cancelled", "rejected"].includes(status)) {
      await Driver.findByIdAndUpdate(booking.driver, { isAvailable: true });
    }
    await createNotification({
      userId: booking.user,
      type: "booking",
      title: "Booking status updated",
      body: `Your booking is now ${status}.`,
      bookingId: booking._id,
    });
    const driver = await Driver.findById(booking.driver).select("user");
    await createNotification({
      userId: driver?.user,
      type: "booking",
      title: "Booking status updated",
      body: `A booking assigned to you is now ${status}.`,
      bookingId: booking._id,
    });
    emitBookingUpdate({ ...booking.toObject(), driver: { user: driver?.user } }, "admin-status");

    const populated = await Booking.findById(booking._id).populate("user", "name email phone").populate({ path: "driver", populate: { path: "user", select: "name email phone" } });
    res.json({ booking: serializeBooking(populated) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update booking status" });
  }
};

exports.updateDriverAvailability = async (req, res) => {
  try {
    const { driverId } = req.params;
    const liveBooking = await Booking.findOne({ driver: driverId, status: { $in: LIVE_TRIP_STATUSES } }).select("_id");
    if (liveBooking) return res.status(409).json({ message: "Driver is active on a live trip. Complete the trip before changing availability." });
    const driver = await Driver.findByIdAndUpdate(driverId, { isAvailable: Boolean(req.body.isAvailable) }, { new: true }).populate("user", "name email phone role");
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json({ driver: serializeDriver(driver) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update driver availability" });
  }
};

exports.updateDriverDocumentStatus = async (req, res) => {
  try {
    const { driverId, documentKey } = req.params;
    const { status } = req.body;

    if (!DOCUMENT_KEYS.includes(documentKey)) {
      return res.status(400).json({ message: "Invalid document type" });
    }
    if (!DOCUMENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid document status" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const currentDocument = driver.documents?.[documentKey] || {};
    driver.documents = driver.documents || {};
    driver.documents[documentKey] = { reference: currentDocument.reference || "", status };
    driver.markModified("documents");
    await driver.save();

    const populated = await Driver.findById(driver._id).populate("user", "name email phone role");
    res.json({ message: "Document status updated", driver: serializeDriver(populated) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update document status" });
  }
};

exports.updateEmployerDocumentStatus = async (req, res) => {
  try {
    const { userId, documentKey } = req.params;
    const { status } = req.body;

    if (!EMPLOYER_DOCUMENT_KEYS.includes(documentKey)) {
      return res.status(400).json({ message: "Invalid document type" });
    }
    if (!DOCUMENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid document status" });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== "user") return res.status(404).json({ message: "Employer not found" });

    user.employerProfile = user.employerProfile || {};
    user.employerProfile.documents = user.employerProfile.documents || {};
    const currentDocument = user.employerProfile.documents?.[documentKey] || {};
    user.employerProfile.documents[documentKey] = { reference: currentDocument.reference || "", status };
    user.markModified("employerProfile");
    await user.save();

    res.json({ message: "Employer document status updated", user: serializeUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update employer document status" });
  }
};

exports.deleteDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const liveBooking = await Booking.findOne({ driver: driverId, status: { $in: LIVE_TRIP_STATUSES } }).select("_id");
    if (liveBooking) return res.status(409).json({ message: "Driver is active on a live trip. Complete the trip before deleting this driver." });
    await Driver.findByIdAndDelete(driverId);
    res.json({ message: "Driver deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete driver" });
  }
};

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    adminLevel: user.adminLevel || "standard",
    adminStatus: user.adminStatus || "active",
    adminVerified: Boolean(user.adminVerified),
    employerProfile: user.employerProfile || {},
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeAdminUser(user) {
  return {
    _id: user._id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    adminLevel: user.adminLevel || "standard",
    adminStatus: user.adminStatus || "active",
    adminVerified: Boolean(user.adminVerified),
    adminVerifiedAt: user.adminVerifiedAt,
    adminCreatedBy: user.adminCreatedBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeDriver(driver, liveBooking = null) {
  const completedTrips = 0;
  const documents = {
    id: normalizeDocument(driver.documents?.id),
    driversLicense: normalizeDocument(driver.documents?.driversLicense),
    proofOfAddress: normalizeDocument(driver.documents?.proofOfAddress),
  };
  const verifiedDocuments = DOCUMENT_KEYS.filter((key) => documents[key].status === "verified").length;

  return {
    _id: driver._id,
    name: driver.name || driver.user?.name || "",
    email: driver.email || driver.user?.email || "",
    phone: driver.phone || driver.user?.phone || "",
    user: driver.user,
    experience: driver.experience || 0,
    rating: driver.rating,
    currentState: driver.currentState || "",
    isAvailable: Boolean(driver.isAvailable),
    isActiveTrip: Boolean(liveBooking),
    activeBookingId: liveBooking?._id || "",
    activeTripStartedAt: liveBooking?.startedAt || liveBooking?.arrivedAt || liveBooking?.updatedAt || null,
    location: driver.location || "",
    vehicle: driver.vehicle || {},
    routeExperience: driver.routeExperience || [],
    documents,
    profilePicture: driver.profilePicture || "",
    readinessScore: Math.round(((verifiedDocuments / DOCUMENT_KEYS.length) * 45) + Math.min(Number(driver.experience || 0) * 5, 35) + (driver.routeExperience?.length ? 20 : 0)),
    completedTrips,
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

function serializeBooking(booking) {
  const driverCoordinates = parseLocation(booking.driver?.location);
  const employerCoordinates = getBookingCoordinates(booking.pickupLocation);
  return {
    id: booking._id,
    employerName: booking.user?.name || booking.user?.email || booking.user?.phone || "Employer",
    employerEmail: booking.user?.email || "",
    employerPhone: booking.user?.phone || "",
    driverName: booking.driver?.name || booking.driver?.user?.name || "Chauffeur",
    driverEmail: booking.driver?.email || booking.driver?.user?.email || "",
    driverPhone: booking.driver?.phone || booking.driver?.user?.phone || "",
    serviceType: booking.serviceType,
    urgency: booking.urgency,
    status: booking.status,
    isLiveTrip: LIVE_TRIP_STATUSES.includes(booking.status),
    pickupAddress: booking.pickupLocation?.address || "",
    destinationAddress: booking.destinationLocation?.address || "",
    notes: booking.notes || "",
    routeUrl: buildDirectionsUrl(driverCoordinates, employerCoordinates),
    driverCoordinates,
    employerCoordinates,
    acceptedAt: booking.acceptedAt,
    startedAt: booking.startedAt,
    arrivedAt: booking.arrivedAt,
    completedAt: booking.completedAt,
    date: booking.date,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

function normalizeDocument(document = {}) {
  const status = DOCUMENT_STATUSES.includes(document.status) ? document.status : "missing";
  return { status, reference: document.reference || "" };
}

function buildAdminNotifications(activeBookings, pendingDriverDocuments, pendingEmployerDocuments, drivers) {
  const notices = [];
  const liveTrips = activeBookings.filter((booking) => booking.status === "started").length;
  if (liveTrips) notices.push({ id: "live-trips", title: "Live trips in progress", body: `${liveTrips} trip${liveTrips === 1 ? "" : "s"} currently started by chauffeurs.`, type: "booking", count: liveTrips });
  if (activeBookings.length) notices.push({ id: "active-bookings", title: "Active bookings need tracking", body: `${activeBookings.length} booking${activeBookings.length === 1 ? "" : "s"} currently requested, accepted, started, or arrived.`, type: "booking", count: activeBookings.length });
  if (pendingDriverDocuments) notices.push({ id: "driver-documents", title: "Driver documents pending", body: `${pendingDriverDocuments} driver document${pendingDriverDocuments === 1 ? "" : "s"} waiting for admin review.`, type: "verification", count: pendingDriverDocuments });
  if (pendingEmployerDocuments) notices.push({ id: "employer-documents", title: "Employer documents pending", body: `${pendingEmployerDocuments} employer document${pendingEmployerDocuments === 1 ? "" : "s"} waiting for admin review.`, type: "verification", count: pendingEmployerDocuments });
  const offlineDrivers = drivers.filter((driver) => !driver.isAvailable).length;
  notices.push({ id: "driver-supply", title: "Driver supply status", body: `${drivers.length - offlineDrivers} of ${drivers.length} chauffeurs currently available.`, type: "supply", count: drivers.length - offlineDrivers });
  return notices;
}

function parseLocation(value) {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) && !(parts[0] === 0 && parts[1] === 0) ? { latitude: parts[0], longitude: parts[1] } : null;
}

function getBookingCoordinates(location = {}) {
  if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) return null;
  return { latitude: Number(location.latitude), longitude: Number(location.longitude) };
}

function buildDirectionsUrl(from, to) {
  if (!from || !to) return "";
  const origin = `${from.latitude},${from.longitude}`;
  const destination = `${to.latitude},${to.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}
