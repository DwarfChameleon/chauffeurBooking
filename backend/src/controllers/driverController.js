// controllers/driverController.js

const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { NIGERIA_PHONE_ERROR, isValidNigeriaPhone, normalizeNigeriaPhone } = require('../utils/nigeriaPhone');
const SERVICE_STATES = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];

const DOCUMENT_KEYS = ["id", "driversLicense", "proofOfAddress"];
const ACTIVE_BOOKING_STATUSES = ['requested', 'assigned', 'accepted', 'started', 'arrived'];

exports.addDriver = async (req, res) => {
  try {
    const { contact, method, name, email, phone, experience = 0 } = req.body;
    const location = req.body.location ? JSON.parse(req.body.location) : null;

    if (!contact && !email && !phone) {
      return res.status(400).json({ message: "Driver contact is required" });
    }
    const driverPhone = phone || (method === "phone" ? contact : undefined);
    if (driverPhone && !isValidNigeriaPhone(driverPhone)) {
      return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    }

    const newDriver = new Driver({
      name: name || contact || email || phone,
      phone: driverPhone ? normalizeNigeriaPhone(driverPhone) : undefined,
      email: email || (method === "email" ? contact : undefined),
      experience,
      location: location ? `${location.latitude}, ${location.longitude}` : undefined,
      isAvailable: true,
      verificationPhoto: req.file ? req.file.originalname : undefined,
      user: req.user.id,
    });

    await newDriver.save();
    res.status(201).json(newDriver);
  } catch (err) {
    console.error('Error adding driver:', err);
    res.status(500).json({ message: 'Failed to add driver' });
  }
};

exports.getAvailableDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ isAvailable: true });
    res.status(200).json({ drivers });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getDriverProfile = async (req, res) => {
  try {
    const driver = await findOrCreateDriverProfile(req.user.id, true);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    const bookings = await Booking.find({ driver: driver._id }).sort({ date: -1, createdAt: -1 });
    res.json(buildDriverProfileResponse(driver, bookings));
  } catch (error) {
    console.error('Driver profile failed:', error);
    res.status(500).json({ message: 'Could not load driver profile' });
  }
};

exports.updateDriverProfile = async (req, res) => {
  try {
    let driver = await findOrCreateDriverProfile(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    const update = buildDriverProfileUpdate(req.body, driver);
    driver = await Driver.findOneAndUpdate({ user: req.user.id }, update, { new: true, runValidators: true }).populate('user', 'name email phone');
    const bookings = await Booking.find({ driver: driver._id }).sort({ date: -1, createdAt: -1 });
    res.json(buildDriverProfileResponse(driver, bookings));
  } catch (error) {
    console.error('Driver profile update failed:', error);
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Could not update driver profile' });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Profile picture is required' });
    const driver = await findOrCreateDriverProfile(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    driver.profilePicture = toUploadUrl(req, req.file);
    await driver.save();

    const populatedDriver = await Driver.findById(driver._id).populate('user', 'name email phone');
    const bookings = await Booking.find({ driver: driver._id }).sort({ date: -1, createdAt: -1 });
    res.json(buildDriverProfileResponse(populatedDriver, bookings));
  } catch (error) {
    console.error('Profile picture upload failed:', error);
    res.status(500).json({ message: 'Could not upload profile picture' });
  }
};

exports.uploadDriverDocument = async (req, res) => {
  try {
    const { documentKey } = req.params;
    if (!DOCUMENT_KEYS.includes(documentKey)) return res.status(400).json({ message: 'Invalid document type' });
    if (!req.file) return res.status(400).json({ message: 'Document file is required' });

    const driver = await findOrCreateDriverProfile(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    driver.documents = driver.documents || {};
    driver.documents[documentKey] = { status: 'pending', reference: toUploadUrl(req, req.file) };
    await driver.save();

    const populatedDriver = await Driver.findById(driver._id).populate('user', 'name email phone');
    const bookings = await Booking.find({ driver: driver._id }).sort({ date: -1, createdAt: -1 });
    res.json(buildDriverProfileResponse(populatedDriver, bookings));
  } catch (error) {
    console.error('Driver document upload failed:', error);
    res.status(500).json({ message: 'Could not upload driver document' });
  }
};

exports.getDriverDashboard = async (req, res) => {
  try {
    const driver = await findOrCreateDriverProfile(req.user.id, true);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const bookings = await Booking.find({ driver: driver._id })
      .populate('user', 'name email phone')
      .sort({ date: 1, createdAt: -1 });
    const todayBookings = bookings.filter((booking) => booking.date >= start && booking.date < end);
    const completedBookings = bookings.filter((booking) => booking.status === 'completed');
    const nextBooking = bookings.find((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status));
    const locationParts = String(driver.location || '').split(',').map((part) => Number(part.trim()));
    const hasCoordinates = locationParts.length === 2 && locationParts.every((value) => Number.isFinite(value));

    res.json({
      driver: {
        id: driver._id,
        name: driver.name || driver.user?.name || 'Driver',
        email: driver.email || driver.user?.email,
        phone: driver.phone || driver.user?.phone,
        isOnline: driver.isAvailable,
        verificationStatus: driver.verificationPhoto ? 'active' : 'pending',
        avatar: driver.profilePicture || null,
      },
      dashboardStats: {
        todayBookings: todayBookings.length,
        bookingGrowth: null,
        todayEarnings: null,
        earningGrowth: null,
        totalTrips: completedBookings.length,
        rating: null,
        reviews: 0,
      },
      currentLocation: hasCoordinates ? { name: 'Current position', city: 'Location sharing active', latitude: locationParts[0], longitude: locationParts[1] } : { name: 'Location unavailable', city: 'Enable location sharing to update', latitude: null, longitude: null },
      nextBooking: nextBooking ? serializeDriverBooking(nextBooking, driver) : null,
      todaySchedule: todayBookings.map((booking) => serializeDriverBooking(booking, driver)),
      recentActivities: bookings.slice(0, 5).map((booking) => ({
        title: booking.status === 'completed' ? 'Trip completed' : booking.status === 'requested' ? 'New booking request' : booking.status === 'started' ? 'Trip started' : booking.status === 'arrived' ? 'Arrival marked' : 'Booking accepted',
        description: booking.pickupLocation?.address || booking.serviceType.replace('_', ' '),
        time: booking.date ? new Date(booking.date).toLocaleString() : 'Recently',
        type: booking.status === 'completed' ? 'completed' : 'booking',
        icon: booking.status === 'completed' ? 'checkmark-circle-outline' : booking.status === 'started' ? 'navigate-outline' : booking.status === 'arrived' ? 'location-outline' : 'calendar-outline',
      })),
    });
  } catch (error) {
    console.error('Driver dashboard failed:', error);
    res.status(500).json({ message: 'Could not load driver dashboard' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    await findOrCreateDriverProfile(req.user.id);
    const driver = await Driver.findOneAndUpdate({ user: req.user.id }, { isAvailable: Boolean(req.body.isOnline) }, { new: true });
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });
    res.json({ isOnline: driver.isAvailable });
  } catch (error) {
    res.status(500).json({ message: 'Could not update availability' });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return res.status(400).json({ message: 'Valid coordinates are required' });
    await findOrCreateDriverProfile(req.user.id);
    const driver = await Driver.findOneAndUpdate({ user: req.user.id }, { location: `${Number(latitude)}, ${Number(longitude)}` }, { new: true });
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });
    res.json({ latitude: Number(latitude), longitude: Number(longitude) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update location' });
  }
};

exports.getDriverBookings = async (req, res) => {
  try {
    const driver = await findOrCreateDriverProfile(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    const bookings = await Booking.find({ driver: driver._id })
      .populate('user', 'name email phone')
      .sort({ date: -1, createdAt: -1 });

    res.json({ bookings: bookings.map((booking) => serializeDriverBooking(booking, driver)) });
  } catch (error) {
    console.error('Driver bookings failed:', error);
    res.status(500).json({ message: 'Could not load driver bookings' });
  }
};

exports.getDriverEarnings = async (req, res) => {
  try {
    const driver = await findOrCreateDriverProfile(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found' });

    const bookings = await Booking.find({ driver: driver._id }).sort({ date: -1, createdAt: -1 });
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const completedTrips = bookings.filter((booking) => booking.status === 'completed');
    const todayBookings = bookings.filter((booking) => booking.date >= start && booking.date < end);
    const upcomingBookings = bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status) && booking.date >= now);
    const serviceBreakdown = bookings.reduce((summary, booking) => {
      summary[booking.serviceType] = (summary[booking.serviceType] || 0) + 1;
      return summary;
    }, {});

    res.json({
      summary: {
        completedTrips: completedTrips.length,
        todayBookings: todayBookings.length,
        upcomingBookings: upcomingBookings.length,
        totalBookings: bookings.length,
        todayEarnings: null,
        totalEarnings: null,
      },
      serviceBreakdown,
      message: 'Earnings will show once fare/payment tracking is added to bookings.',
    });
  } catch (error) {
    console.error('Driver earnings failed:', error);
    res.status(500).json({ message: 'Could not load driver earnings' });
  }
};

function buildDriverProfileUpdate(body, currentDriver) {
  const personalInformation = body.personalInformation || {};
  const vehicle = body.vehicle || {};
  const currentDocuments = currentDriver.documents || {};
  const phone = cleanString(body.phone);
  const emergencyContactPhone = cleanString(personalInformation.emergencyContactPhone);

  if (!isValidNigeriaPhone(phone) || !isValidNigeriaPhone(emergencyContactPhone)) {
    throw httpError(400, NIGERIA_PHONE_ERROR);
  }

  return {
    name: cleanString(body.name),
    phone: phone ? normalizeNigeriaPhone(phone) : undefined,
    email: cleanString(body.email).toLowerCase() || undefined,
    experience: cleanNumber(body.yearsOfDriving),
    profilePicture: cleanString(body.profilePicture) || currentDriver.profilePicture || undefined,
    currentState: SERVICE_STATES.includes(body.currentState) ? body.currentState : "",
    licenseNumber: cleanString(body.licenseNumber),
    licenseYear: cleanOptionalNumber(body.licenseYear),
    personalInformation: {
      address: cleanString(personalInformation.address),
      dateOfBirth: cleanString(personalInformation.dateOfBirth),
      emergencyContactName: cleanString(personalInformation.emergencyContactName),
      emergencyContactPhone: emergencyContactPhone ? normalizeNigeriaPhone(emergencyContactPhone) : '',
    },
    routeExperience: Array.isArray(body.routeExperience)
      ? body.routeExperience.map((item) => ({
          state: item.state,
          routes: cleanString(item.routes),
          years: cleanNumber(item.years),
        })).filter((item) => SERVICE_STATES.includes(item.state))
      : [],
    vehicle: {
      transmission: ["automatic", "manual", "both"].includes(vehicle.transmission) ? vehicle.transmission : "",
      type: ["all", "suv_small_cars", "suv", "truck", "small_car", "motorcycle", "van", "bus"].includes(vehicle.type) ? vehicle.type : "",
      plateNumber: cleanString(vehicle.plateNumber),
      model: cleanString(vehicle.model),
    },
    documents: {
      id: normalizeDocument(currentDocuments.id),
      driversLicense: normalizeDocument(currentDocuments.driversLicense),
      proofOfAddress: normalizeDocument(currentDocuments.proofOfAddress),
    },
  };
}

function buildDriverProfileResponse(driver, bookings) {
  const profile = {
    id: driver._id,
    name: driver.name || driver.user?.name || '',
    email: driver.email || driver.user?.email || '',
    phone: driver.phone || driver.user?.phone || '',
    yearsOfDriving: driver.experience || 0,
    currentState: driver.currentState || '',
    licenseNumber: driver.licenseNumber || '',
    licenseYear: driver.licenseYear || null,
    profilePicture: driver.profilePicture || '',
    personalInformation: {
      address: driver.personalInformation?.address || '',
      dateOfBirth: driver.personalInformation?.dateOfBirth || '',
      emergencyContactName: driver.personalInformation?.emergencyContactName || '',
      emergencyContactPhone: driver.personalInformation?.emergencyContactPhone || '',
    },
    routeExperience: buildRouteExperience(driver.routeExperience || []),
    vehicle: {
      transmission: driver.vehicle?.transmission || '',
      type: driver.vehicle?.type || '',
      plateNumber: driver.vehicle?.plateNumber || '',
      model: driver.vehicle?.model || '',
    },
    documents: {
      id: normalizeDocument(driver.documents?.id),
      driversLicense: normalizeDocument(driver.documents?.driversLicense),
      proofOfAddress: normalizeDocument(driver.documents?.proofOfAddress),
    },
  };

  return {
    profile,
    routeOptions: buildRouteOptions(),
    completeness: calculateProfileCompleteness(profile),
    performance: calculateSkillPerformance(profile, bookings),
  };
}

function buildRouteOptions() {
  return {
    Bayelsa: ['Yenagoa - Amassoma', 'Yenagoa - Ogbia', 'Yenagoa - Sagbama', 'Yenagoa - Port Harcourt'],
    Delta: ['Warri - Asaba', 'Warri - Sapele', 'Asaba - Agbor', 'Ughelli - Warri'],
    Benin: ['Benin - Airport Road', 'Benin - Ring Road', 'Benin - Ugbowo', 'Benin - GRA'],
    Rivers: ['Port Harcourt - Aba Road', 'Port Harcourt - Onne', 'Port Harcourt - Bonny', 'Port Harcourt - Ahoada'],
    Calabar: ['Calabar - Marian Road', 'Calabar - Tinapa', 'Calabar - Akpabuyo', 'Calabar - Odukpani'],
    Abia: ['Aba - Umuahia', 'Umuahia - Ohafia', 'Aba - Ariaria', 'Umuahia - Isiala Ngwa'],
    'Akwa Ibom': ['Uyo - Eket', 'Uyo - Ikot Ekpene', 'Uyo - Oron', 'Uyo - Abak'],
    Edo: ['Benin - Auchi', 'Benin - Ekpoma', 'Benin - Ore', 'Benin - Sapele Road'],
    Abuja: ['Wuse - Maitama', 'Garki - Asokoro', 'Central Area - Gwarinpa', 'Airport Road - Lugbe'],
    Lagos: ['VI - Lekki', 'Ikeja - Yaba', 'Ikoyi - Marina', 'Surulere - Apapa'],
  };
}

function buildRouteExperience(routeExperience) {
  const savedRoutes = new Map(routeExperience.map((item) => [item.state, item]));
  return SERVICE_STATES.map((state) => {
    const route = savedRoutes.get(state);
    return { state, routes: route?.routes || '', years: route?.years || 0 };
  });
}

function calculateProfileCompleteness(profile) {
  const checks = [
    { key: 'personal', label: 'Personal information', complete: Boolean(profile.name && (profile.email || profile.phone) && profile.personalInformation.address) },
    { key: 'license', label: 'Driver license details', complete: Boolean(profile.licenseNumber && profile.licenseYear) },
    { key: 'routes', label: 'Route experience', complete: profile.routeExperience.some((route) => route.years > 0 && route.routes) },
    { key: 'vehicle', label: 'Vehicle information', complete: Boolean(profile.vehicle.transmission && profile.vehicle.type) },
    { key: 'profilePicture', label: 'Profile picture', complete: Boolean(profile.profilePicture) },
    { key: 'id', label: 'ID verification', complete: profile.documents.id.status === 'verified' || Boolean(profile.documents.id.reference) },
    { key: 'driversLicense', label: 'License verification', complete: profile.documents.driversLicense.status === 'verified' || Boolean(profile.documents.driversLicense.reference) },
    { key: 'proofOfAddress', label: 'Proof of address', complete: profile.documents.proofOfAddress.status === 'verified' || Boolean(profile.documents.proofOfAddress.reference) },
  ];
  const completed = checks.filter((check) => check.complete).length;

  return {
    score: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
    checks,
  };
}

function calculateSkillPerformance(profile, bookings) {
  const completedTrips = bookings.filter((booking) => booking.status === 'completed').length;
    const assignedTrips = bookings.filter((booking) => ['assigned', 'accepted', 'started', 'arrived', 'completed'].includes(booking.status)).length;
  const completionScore = assignedTrips ? Math.round((completedTrips / assignedTrips) * 25) : 0;
  const routeScore = Math.min(profile.routeExperience.filter((route) => route.years > 0 && route.routes).length * 10, 25);
  const experienceScore = Math.min(Number(profile.yearsOfDriving || 0) * 4, 25);
  const vehicleScore = profile.vehicle.transmission && profile.vehicle.type ? 15 : profile.vehicle.transmission || profile.vehicle.type ? 8 : 0;
  const documentScore = ['id', 'driversLicense', 'proofOfAddress'].filter((key) => profile.documents[key].status === 'verified' || profile.documents[key].reference).length * 3;
  const score = Math.min(100, Math.round(completionScore + routeScore + experienceScore + vehicleScore + documentScore));

  return {
    score,
    label: score >= 80 ? 'High readiness' : score >= 55 ? 'Good readiness' : score >= 30 ? 'Needs profile depth' : 'New driver profile',
    completedTrips,
    routeCoverage: profile.routeExperience.filter((route) => route.years > 0 && route.routes).map((route) => route.state),
    strengths: buildPerformanceStrengths(profile, completedTrips),
  };
}

function buildPerformanceStrengths(profile, completedTrips) {
  const strengths = [];
  if (profile.yearsOfDriving >= 5) strengths.push('Experienced driver');
  if (profile.routeExperience.some((route) => route.state === 'Rivers' && route.years > 0)) strengths.push('Rivers route knowledge');
  if (profile.routeExperience.some((route) => route.state === 'Bayelsa' && route.years > 0)) strengths.push('Bayelsa route knowledge');
  if (profile.vehicle.type === 'truck') strengths.push('Truck-capable');
  if (profile.vehicle.type === 'all') strengths.push('All vehicle types');
  if (profile.vehicle.type === 'suv_small_cars') strengths.push('SUV and small cars');
  if (profile.vehicle.type === 'suv') strengths.push('SUV-capable');
  if (profile.vehicle.transmission === 'both') strengths.push('Manual and automatic');
  if (completedTrips > 0) strengths.push(`${completedTrips} completed trip${completedTrips === 1 ? '' : 's'}`);
  return strengths;
}

function normalizeDocument(document = {}) {
  const status = ["missing", "pending", "verified", "rejected"].includes(document.status) ? document.status : "missing";
  return { status, reference: cleanString(document.reference) };
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function cleanOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  return cleanNumber(value);
}

function toUploadUrl(req, file) {
  const normalizedPath = file.path.replace(/\\/g, '/');
  const uploadIndex = normalizedPath.lastIndexOf('/uploads/');
  const publicPath = uploadIndex >= 0 ? normalizedPath.slice(uploadIndex) : `/uploads/${file.filename}`;
  return `${req.protocol}://${req.get('host')}${publicPath}`;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function findOrCreateDriverProfile(userId, shouldPopulate = false) {
  let driver = await Driver.findOne({ user: userId });
  if (!driver) {
    const user = await User.findById(userId);
    if (!user || user.role !== 'driver') return null;

    driver = await Driver.create({
      name: user.name || user.email || user.phone || 'Driver',
      email: user.email,
      phone: user.phone,
      experience: 0,
      isAvailable: false,
      user: user._id,
    });
  }

  return shouldPopulate ? Driver.findById(driver._id).populate('user', 'name email phone') : driver;
}

function serializeDriverBooking(booking, activeDriver) {
  const driverCoordinates = parseLocation(activeDriver?.location || booking.driver?.location);
  const employerCoordinates = getBookingCoordinates(booking.pickupLocation);
  return {
    id: booking._id,
    customerName: booking.user?.name || booking.user?.email || booking.user?.phone || 'Dispatch customer',
    customerAvatar: null,
    pickup: booking.pickupLocation?.address || 'Pickup location pending',
    destination: booking.destinationLocation?.address || booking.notes || 'Destination pending',
    destinationAddress: booking.destinationLocation?.address || '',
    notes: booking.notes || '',
    time: booking.date ? new Date(booking.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Time pending',
    amount: null,
    status: mapDriverBookingStatus(booking.status),
    rawStatus: booking.status,
    routeUrl: buildDirectionsUrl(driverCoordinates, employerCoordinates),
    driverCoordinates,
    employerCoordinates,
    acceptedAt: booking.acceptedAt,
    startedAt: booking.startedAt,
    arrivedAt: booking.arrivedAt,
    completedAt: booking.completedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

function mapDriverBookingStatus(status) {
  if (status === 'requested') return 'pending';
  if (status === 'assigned' || status === 'accepted') return 'confirmed';
  if (status === 'started') return 'started';
  if (status === 'arrived') return 'arrived';
  if (status === 'completed') return 'completed';
  return 'cancelled';
}

function parseLocation(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) && !(parts[0] === 0 && parts[1] === 0) ? { latitude: parts[0], longitude: parts[1] } : null;
}

function getBookingCoordinates(location = {}) {
  if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) return null;
  return { latitude: Number(location.latitude), longitude: Number(location.longitude) };
}

function buildDirectionsUrl(from, to) {
  if (!from || !to) return '';
  const origin = `${from.latitude},${from.longitude}`;
  const destination = `${to.latitude},${to.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
