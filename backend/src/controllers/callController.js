const crypto = require("crypto");

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
