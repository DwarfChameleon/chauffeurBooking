const USER_AGENT = "chauffeur-booking-location-service/1.0";
const SERVICE_STATES = ["Bayelsa", "Delta", "Benin", "Rivers", "Calabar", "Abia", "Akwa Ibom", "Edo", "Abuja", "Lagos"];

const KNOWN_PLACES = [
  {
    aliases: ["fmc yenagoa", "fmc yennagoa", "federal medical centre yenagoa", "federal medical center yenagoa"],
    name: "Federal Medical Centre Yenagoa",
    city: "Yenagoa",
    state: "Bayelsa",
    coordinates: { latitude: 4.9382647, longitude: 6.2668961 },
  },
  {
    aliases: ["igbogene", "igbogene yenagoa", "igbogene bayelsa"],
    name: "Igbogene",
    city: "Yenagoa",
    state: "Bayelsa",
    coordinates: { latitude: 5.0361785, longitude: 6.3978462 },
  },
];

async function resolveRoute(payload = {}) {
  const context = [payload.title, payload.pickupLabel, payload.destinationLabel].filter(Boolean).join(" ");
  const driver = toCoordinate(payload.driverCoordinates) || extractCoordinates(payload.driverLabel);
  const pickup = toCoordinate(payload.pickupCoordinates) || await resolvePlace(payload.pickupLabel, context);
  const destination = await resolvePlace(payload.destinationLabel, context);

  if (pickup && destination) {
    return {
      start: withLabel(pickup, payload.pickupLabel),
      end: withLabel(destination, payload.destinationLabel),
      mode: "pickup-destination",
    };
  }
  if (driver && pickup) {
    return {
      start: withLabel(driver, payload.driverLabel),
      end: withLabel(pickup, payload.pickupLabel),
      mode: "driver-pickup",
    };
  }
  return { start: null, end: null, mode: "unresolved" };
}

async function resolvePlace(value = "", context = "") {
  const coordinate = extractCoordinates(value);
  if (coordinate) return reverseCoordinate(coordinate, value);

  const query = normalizePlaceName(value);
  if (!query || ["driver", "pickup", "employer pickup", "destination pending", "pickup pending"].includes(query.toLowerCase())) return null;

  const known = knownPlace(query);
  if (known) return known;

  for (const candidate of geocodeCandidates(query, context)) {
    const found = await fetchGeocode(candidate);
    if (found) return found;
  }
  return null;
}

function toCoordinate(value) {
  if (!value) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function extractCoordinates(value = "") {
  if (typeof value !== "string") return null;
  const coordinatePair = value.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!coordinatePair) return null;
  const first = Number(coordinatePair[1]);
  const second = Number(coordinatePair[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return { latitude: first, longitude: second };
  if (Math.abs(second) <= 90 && Math.abs(first) <= 180) return { latitude: second, longitude: first };
  return null;
}

function knownPlace(query) {
  const normalized = normalizeKey(query);
  const place = KNOWN_PLACES.find((item) => item.aliases.some((alias) => normalized.includes(normalizeKey(alias))));
  if (!place) return null;
  return { ...place.coordinates, name: place.name, city: place.city, state: place.state, source: "known-place" };
}

function geocodeCandidates(query, context = "") {
  const normalizedContext = `${query} ${context}`.toLowerCase();
  const hasStateContext = SERVICE_STATES.some((state) => normalizedContext.includes(state.toLowerCase()));
  const isBayelsaRoute = /bayelsa|yenagoa|yenegoa|yennagoa|igbogene|fmc|federal medical/.test(normalizedContext);
  const candidates = isBayelsaRoute
    ? [`${query}, Yenagoa, Bayelsa, Nigeria`, `${query}, Bayelsa, Nigeria`, `${query}, Nigeria`, query]
    : hasStateContext
      ? [`${query}, Nigeria`, query]
      : [`${query}, Nigeria`, query];
  return [...new Set(candidates)];
}

async function fetchGeocode(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=ng&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) return null;
    const results = await response.json();
    const first = results[0];
    if (!first || !Number.isFinite(Number(first.lat)) || !Number.isFinite(Number(first.lon))) return null;
    return {
      latitude: Number(first.lat),
      longitude: Number(first.lon),
      name: first.display_name || query,
      city: cityFromAddress(first.address || {}),
      state: first.address?.state || "",
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

async function reverseCoordinate(coordinate, fallbackName = "") {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${coordinate.latitude}&lon=${coordinate.longitude}`;
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error("Reverse geocode failed");
    const data = await response.json();
    return {
      ...coordinate,
      name: data.display_name || fallbackName,
      city: cityFromAddress(data.address || {}),
      state: data.address?.state || "",
      source: "coordinate",
    };
  } catch {
    return { ...coordinate, name: fallbackName, city: "", state: "", source: "coordinate" };
  }
}

function withLabel(point, label = "") {
  return { ...point, label: label || point.name || "Route point" };
}

function cityFromAddress(address) {
  return address.city || address.town || address.village || address.municipality || address.county || "";
}

function normalizePlaceName(value = "") {
  return String(value)
    .trim()
    .replace(/\byennagoa\b/gi, "Yenagoa")
    .replace(/\byenegoa\b/gi, "Yenagoa")
    .replace(/\bfmc\b/gi, "Federal Medical Centre")
    .replace(/\s+/g, " ");
}

function normalizeKey(value = "") {
  return normalizePlaceName(value).toLowerCase().replace(/[-_\s,]+/g, "");
}

module.exports = { resolveRoute, resolvePlace, extractCoordinates };
