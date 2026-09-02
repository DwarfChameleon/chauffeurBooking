const User = require('../models/User');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const { NIGERIA_PHONE_ERROR, isValidNigeriaPhone, normalizeNigeriaPhone } = require('../utils/nigeriaPhone');
const { resolveUploadUrl } = require('../utils/uploadStorage');

const STATES = ['Bayelsa', 'Delta', 'Benin', 'Rivers', 'Calabar', 'Abia', 'Akwa Ibom', 'Edo', 'Abuja', 'Lagos'];
const EMPLOYER_DOCUMENT_KEYS = ['id', 'proofOfAddress'];
const ACTIVE_BOOKING_STATUSES = ['requested', 'assigned', 'accepted', 'started', 'arrived'];

exports.getEmployerProfile = async (req, res) => {
  try {
    const user = await requireEmployer(req.user.id);
    const bookings = await loadEmployerBookings(user._id);
    res.json({ profile: serializeEmployer(user), completeness: calculateEmployerCompleteness(user), stats: buildEmployerStats(bookings, []), stateOptions: STATES });
  } catch (error) {
    sendEmployerError(res, error, 'Could not load employer profile');
  }
};

exports.updateEmployerProfile = async (req, res) => {
  try {
    const user = await requireEmployer(req.user.id);
    const profile = req.body.employerProfile || {};
    const state = STATES.includes(profile.state) ? profile.state : '';
    const preferredService = ['emergency_dispatch', 'ride_hailing', 'logistics', 'chauffeur', 'field_verification', ''].includes(profile.preferredService) ? profile.preferredService : '';
    const vehicleType = ['suv', 'truck', 'small_car', 'motorcycle', 'van', 'bus', ''].includes(profile.vehicleType) ? profile.vehicleType : '';
    const transmission = ['automatic', 'manual', 'both', ''].includes(profile.transmission) ? profile.transmission : '';
    const currentEmployerProfile = user.employerProfile?.toObject?.() || user.employerProfile || {};
    const accountType = ['personal', 'organization', ''].includes(profile.accountType) ? profile.accountType : currentEmployerProfile.accountType || '';
    const phone = cleanString(req.body.phone);
    const emergencyContactPhone = cleanString(profile.emergencyContactPhone);

    if (!isValidNigeriaPhone(phone) || !isValidNigeriaPhone(emergencyContactPhone)) {
      return res.status(400).json({ message: NIGERIA_PHONE_ERROR });
    }

    user.name = cleanString(req.body.name) || user.name;
    user.email = cleanString(req.body.email).toLowerCase() || user.email;
    user.phone = phone ? normalizeNigeriaPhone(phone) : user.phone;
    user.employerProfile = {
      ...currentEmployerProfile,
      profilePicture: cleanString(profile.profilePicture) || currentEmployerProfile.profilePicture || '',
      accountType,
      companyName: cleanString(profile.companyName),
      industry: cleanString(profile.industry),
      contactPerson: cleanString(profile.emergencyContactName) || cleanString(profile.contactPerson),
      emergencyContactName: cleanString(profile.emergencyContactName) || cleanString(profile.contactPerson),
      emergencyContactPhone: emergencyContactPhone ? normalizeNigeriaPhone(emergencyContactPhone) : '',
      state,
      town: cleanString(profile.town),
      city: cleanString(profile.city),
      address: cleanString(profile.address),
      latitude: cleanOptionalCoordinate(profile.latitude),
      longitude: cleanOptionalCoordinate(profile.longitude),
      vehicleType,
      transmission,
      preferredService,
      documents: {
        id: normalizeDocument(currentEmployerProfile.documents?.id),
        proofOfAddress: normalizeDocument(currentEmployerProfile.documents?.proofOfAddress),
      },
    };
    user.markModified('employerProfile');
    await user.save();
    const bookings = await loadEmployerBookings(user._id);
    res.json({ profile: serializeEmployer(user), completeness: calculateEmployerCompleteness(user), stats: buildEmployerStats(bookings, []), stateOptions: STATES });
  } catch (error) {
    sendEmployerError(res, error, 'Could not update employer profile');
  }
};

exports.uploadEmployerProfilePicture = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Profile picture is required' });
    const user = await requireEmployer(req.user.id);
    user.employerProfile = user.employerProfile || {};
    user.employerProfile.profilePicture = await resolveUploadUrl(req, req.file, 'employers/profile-pictures');
    await user.save();
    res.json({ profile: serializeEmployer(user), completeness: calculateEmployerCompleteness(user), stateOptions: STATES });
  } catch (error) {
    sendEmployerError(res, error, 'Could not upload employer profile picture');
  }
};

exports.uploadEmployerDocument = async (req, res) => {
  try {
    const { documentKey } = req.params;
    if (!EMPLOYER_DOCUMENT_KEYS.includes(documentKey)) return res.status(400).json({ message: 'Invalid document type' });
    if (!req.file) return res.status(400).json({ message: 'Document file is required' });

    const user = await requireEmployer(req.user.id);
    user.employerProfile = user.employerProfile || {};
    user.employerProfile.documents = user.employerProfile.documents || {};
    user.employerProfile.documents[documentKey] = { status: 'pending', reference: await resolveUploadUrl(req, req.file, `employers/documents/${documentKey}`) };
    await user.save();

    res.json({ profile: serializeEmployer(user), completeness: calculateEmployerCompleteness(user), stateOptions: STATES });
  } catch (error) {
    sendEmployerError(res, error, 'Could not upload employer document');
  }
};

exports.getEmployerDashboard = async (req, res) => {
  try {
    const user = await requireEmployer(req.user.id);
    const bookings = await loadEmployerBookings(user._id);
    const coordinates = getCoordinates(req.query.latitude, req.query.longitude) || getCoordinates(user.employerProfile?.latitude, user.employerProfile?.longitude);
    const nearbyChauffeurs = await findNearbyChauffeurs(user.employerProfile?.state, coordinates);

    res.json({
      employer: serializeEmployer(user),
      completeness: calculateEmployerCompleteness(user),
      stats: buildEmployerStats(bookings, nearbyChauffeurs),
      currentBooking: serializeEmployerBooking(bookings.find((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status)) || null),
      bookingHistory: bookings.slice(0, 6).map(serializeEmployerBooking),
      nearbyChauffeurs: nearbyChauffeurs.slice(0, 4),
    });
  } catch (error) {
    sendEmployerError(res, error, 'Could not load employer dashboard');
  }
};

exports.getNearbyChauffeurs = async (req, res) => {
  try {
    const user = await requireEmployer(req.user.id);
    const state = STATES.includes(req.query.state) ? req.query.state : user.employerProfile?.state || '';
    const coordinates = getCoordinates(req.query.latitude, req.query.longitude) || getCoordinates(user.employerProfile?.latitude, user.employerProfile?.longitude);
    const drivers = await findNearbyChauffeurs(state, coordinates);
    res.json({ state, drivers, count: drivers.length });
  } catch (error) {
    sendEmployerError(res, error, 'Could not load available chauffeurs');
  }
};

async function findNearbyChauffeurs(state, employerCoordinates) {
  const drivers = await Driver.find({ isAvailable: true }).populate('user', 'name email phone');
  const matchingDrivers = state
    ? drivers.filter((driver) => driver.currentState === state || driver.routeExperience?.some((route) => route.state === state && (Number(route.years || 0) > 0 || cleanString(route.routes))))
    : drivers;

  const cards = await Promise.all(matchingDrivers.map(async (driver) => {
    const bookings = await Booking.find({ driver: driver._id }).select('status').lean();
    const completedTrips = bookings.filter((booking) => booking.status === 'completed').length;
    const accidentCount = 0;
    const route = driver.routeExperience?.find((item) => item.state === state) || driver.routeExperience?.find((item) => item.state === driver.currentState) || driver.routeExperience?.[0];
    const routeCoverage = buildDriverRouteCoverage(driver);
    const distanceKm = calculateDistance(employerCoordinates, parseLocation(driver.location));
    const analysis = analyseDriver(driver, completedTrips, accidentCount, state);

    return {
      id: driver._id,
      name: driver.name || driver.user?.name || 'Available chauffeur',
      email: driver.email || driver.user?.email || '',
      phone: driver.phone || driver.user?.phone || '',
      picture: driver.profilePicture || null,
      rating: driver.rating !== null && driver.rating !== undefined && Number.isFinite(Number(driver.rating)) ? Number(driver.rating) : null,
      route: route?.routes || `${route?.state || driver.currentState || state || 'Regional'} route coverage`,
      routeState: route?.state || driver.currentState || state || '',
      routeCoverage,
      routeCoverageLabel: routeCoverage.length === STATES.length ? 'All supported states' : routeCoverage.map((item) => item.state).join(', '),
      distanceKm,
      distanceLabel: distanceKm === null ? 'Distance unavailable' : `${distanceKm.toFixed(1)} km from you`,
      yearsOfExperience: Number(driver.experience || 0),
      experienceLevel: analysis.label,
      readinessScore: analysis.score,
      safetyLevel: analysis.safetyLevel,
      accidentCount,
      completedTrips,
      vehicleType: driver.vehicle?.type || 'Vehicle details pending',
      transmission: driver.vehicle?.transmission || '',
      verificationStatus: allDriverDocumentsVerified(driver) ? 'verified' : 'profile review',
    };
  }));

  return cards.sort((left, right) => {
    if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) return left.distanceKm - right.distanceKm;
    if (left.distanceKm !== null) return -1;
    if (right.distanceKm !== null) return 1;
    return right.readinessScore - left.readinessScore;
  });
}

function buildDriverRouteCoverage(driver) {
  return (driver.routeExperience || [])
    .filter((route) => STATES.includes(route.state) && (Number(route.years || 0) > 0 || cleanString(route.routes)))
    .map((route) => ({
      state: route.state,
      routes: cleanString(route.routes) || `${route.state} routes`,
      years: Number(route.years || 0),
      isCurrent: route.state === driver.currentState,
    }));
}

async function loadEmployerBookings(userId) {
  return Booking.find({ user: userId }).populate('driver').sort({ date: -1, createdAt: -1 });
}

function buildEmployerStats(bookings, chauffeurs) {
  return {
    activeRequests: bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status)).length,
    completedTrips: bookings.filter((booking) => booking.status === 'completed').length,
    cancelledTrips: bookings.filter((booking) => booking.status === 'cancelled').length,
    totalBookings: bookings.length,
    availableChauffeurs: chauffeurs.length,
  };
}

function serializeEmployerBooking(booking) {
  if (!booking) return null;
  const driverCoordinates = parseLocation(booking.driver?.location);
  const employerCoordinates = getBookingCoordinates(booking.pickupLocation);
  return {
    id: booking._id,
    driverId: booking.driver?._id || booking.driver,
    driverName: booking.driver?.name || 'Assigned chauffeur',
    driverPicture: booking.driver?.profilePicture || null,
    serviceType: booking.serviceType,
    urgency: booking.urgency,
    status: booking.status,
    pickupAddress: booking.pickupLocation?.address || 'Pickup location pending',
    destinationAddress: booking.destinationLocation?.address || booking.notes || '',
    date: booking.date,
    displayDate: booking.date ? new Date(booking.date).toLocaleDateString() : 'Date pending',
    displayTime: booking.date ? new Date(booking.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Time pending',
    notes: booking.notes || '',
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

function analyseDriver(driver, completedTrips, accidentCount, state) {
  const years = Number(driver.experience || 0);
  const route = driver.routeExperience?.find((item) => item.state === state) || driver.routeExperience?.[0];
  let score = Math.min(years * 4, 28);
  if (route?.years > 0) score += Math.min(route.years * 4, 20);
  if (driver.vehicle?.transmission && driver.vehicle?.type) score += 15;
  if (allDriverDocumentsVerified(driver)) score += 20;
  score += Math.min(completedTrips * 2, 17);
  score = Math.max(0, Math.min(100, Math.round(score - accidentCount * 8)));
  const safetyLevel = accidentCount === 0 && score >= 70 ? 'High safety' : accidentCount <= 1 && score >= 45 ? 'Standard safety' : 'Needs review';
  return { score, safetyLevel, label: score >= 80 ? 'Expert route-ready' : score >= 55 ? 'Experienced' : score >= 30 ? 'Developing' : 'New profile' };
}

function calculateEmployerCompleteness(user) {
  const profile = serializeEmployer(user);
  const checks = [
    { key: 'picture', label: 'Profile picture', complete: Boolean(profile.employerProfile.profilePicture) },
    { key: 'identity', label: 'Full name and contact', complete: Boolean(profile.name && (profile.email || profile.phone)) },
    { key: 'address', label: 'Address and city', complete: Boolean(profile.employerProfile.address && profile.employerProfile.city && profile.employerProfile.state) },
    { key: 'location', label: 'Distance location', complete: profile.employerProfile.latitude !== null && profile.employerProfile.longitude !== null },
    { key: 'service', label: 'Preferred service', complete: Boolean(profile.employerProfile.preferredService) },
    { key: 'vehicle', label: 'Vehicle preference', complete: Boolean(profile.employerProfile.vehicleType && profile.employerProfile.transmission) },
    { key: 'id', label: 'ID document', complete: profile.employerProfile.documents.id.status === 'verified' || Boolean(profile.employerProfile.documents.id.reference) },
    { key: 'proofOfAddress', label: 'Proof of address', complete: profile.employerProfile.documents.proofOfAddress.status === 'verified' || Boolean(profile.employerProfile.documents.proofOfAddress.reference) },
  ];
  const completed = checks.filter((check) => check.complete).length;
  const verified = ['id', 'proofOfAddress'].every((key) => profile.employerProfile.documents[key].status === 'verified');
  return { score: Math.round((completed / checks.length) * 100), completed, total: checks.length, verified, checks };
}

function allDriverDocumentsVerified(driver) {
  return ['id', 'driversLicense', 'proofOfAddress'].every((key) => driver.documents?.[key]?.status === 'verified');
}

function serializeEmployer(user) {
  const profile = user.employerProfile || {};
  return {
    id: user._id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    employerProfile: {
      profilePicture: profile.profilePicture || '',
      accountType: profile.accountType || '',
      companyName: profile.companyName || '',
      industry: profile.industry || '',
      contactPerson: profile.emergencyContactName || profile.contactPerson || user.name || '',
      emergencyContactName: profile.emergencyContactName || profile.contactPerson || '',
      emergencyContactPhone: profile.emergencyContactPhone || '',
      state: profile.state || '',
      town: profile.town || '',
      city: profile.city || '',
      address: profile.address || '',
      latitude: Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : null,
      longitude: Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : null,
      vehicleType: profile.vehicleType || '',
      transmission: profile.transmission || '',
      preferredService: profile.preferredService || '',
      documents: {
        id: normalizeDocument(profile.documents?.id),
        proofOfAddress: normalizeDocument(profile.documents?.proofOfAddress),
      },
    },
  };
}

async function requireEmployer(userId) {
  const user = await User.findById(userId);
  if (!user) throw httpError(404, 'Employer account not found');
  if (user.role !== 'user') throw httpError(403, 'Employer access required');
  return user;
}

function normalizeDocument(document = {}) {
  const status = ['missing', 'pending', 'verified', 'rejected'].includes(document.status) ? document.status : 'missing';
  return { status, reference: cleanString(document.reference) };
}

function parseLocation(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  return parts.length === 2 && parts.every(Number.isFinite) && !(parts[0] === 0 && parts[1] === 0) ? { latitude: parts[0], longitude: parts[1] } : null;
}

function getCoordinates(latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
  if (Number(latitude) === 0 && Number(longitude) === 0) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function getBookingCoordinates(location = {}) {
  if (!Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) return null;
  return { latitude: Number(location.latitude), longitude: Number(location.longitude) };
}

function calculateDistance(from, to) {
  if (!from || !to) return null;
  const earthRadius = 6371;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function toRadians(value) { return value * Math.PI / 180; }
function buildDirectionsUrl(from, to) {
  if (!from || !to) return '';
  const origin = `${from.latitude},${from.longitude}`;
  const destination = `${to.latitude},${to.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
function cleanString(value) { return typeof value === 'string' ? value.trim() : ''; }
function cleanOptionalCoordinate(value) { return value === '' || value === null || value === undefined ? undefined : Number.isFinite(Number(value)) ? Number(value) : undefined; }
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function sendEmployerError(res, error, fallback) { res.status(error.status || 500).json({ message: error.status ? error.message : fallback }); }
