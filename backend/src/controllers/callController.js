const crypto = require("crypto");
const CallLog = require("../models/CallLog");

const DEFAULT_STUN_URLS = ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"];

function listFromEnv(...keys) {
  return keys
    .flatMap((key) => String(process.env[key] || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildTurnServer(userId) {
  const turnUrls = listFromEnv("TURN_URLS", "TURN_URL", "TURNS_URLS", "TURNS_URL");
  if (!turnUrls.length) return null;

  const sharedSecret = String(process.env.TURN_SHARED_SECRET || "").trim();
  if (sharedSecret) {
    const ttlSeconds = Number(process.env.TURN_TTL_SECONDS || 3600);
    const expiresAt = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 3600);
    const username = `${expiresAt}:${userId}`;
    const credential = crypto.createHmac("sha1", sharedSecret).update(username).digest("base64");
    return { urls: turnUrls, username, credential };
  }

  const username = String(process.env.TURN_USERNAME || "").trim();
  const credential = String(process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD || "").trim();
  return username && credential ? { urls: turnUrls, username, credential } : null;
}

exports.getIceServers = (req, res) => {
  const stunUrls = listFromEnv("ICE_STUN_URLS", "STUN_URLS", "STUN_URL");
  const iceServers = [{ urls: stunUrls.length ? stunUrls : DEFAULT_STUN_URLS }];
  const turnServer = buildTurnServer(req.user.id);
  if (turnServer) iceServers.push(turnServer);

  res.json({
    iceServers,
    turnConfigured: Boolean(turnServer),
  });
};

function serializeCallLog(log) {
  return {
    id: String(log._id),
    callSessionId: log.callSessionId,
    source: log.source,
    target: log.target,
    bookingId: log.booking ? String(log.booking._id || log.booking) : "",
    bookingLabel: log.bookingLabel || "",
    initiatedBy: log.initiatedBy ? String(log.initiatedBy._id || log.initiatedBy) : "",
    initiatedByRole: log.initiatedByRole,
    initiatedBySnapshot: log.initiatedBySnapshot || {},
    participants: (log.participants || []).map((participant) => ({
      user: participant.user ? String(participant.user._id || participant.user) : "",
      role: participant.role,
      label: participant.label,
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      acceptedAt: participant.acceptedAt,
      declinedAt: participant.declinedAt,
    })),
    status: log.status,
    ringStartedAt: log.ringStartedAt,
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    durationSeconds: log.durationSeconds || 0,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

exports.listCallHistory = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const logs = await CallLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("booking", "_id status pickupAddress destinationAddress")
      .lean();

    res.json({ calls: logs.map(serializeCallLog) });
  } catch (error) {
    console.error("List call history failed:", error.message);
    res.status(500).json({ message: "Could not load call history" });
  }
};
