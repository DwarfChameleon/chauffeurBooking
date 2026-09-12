const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const CallLog = require("../models/CallLog");
const Notification = require("../models/Notification");
const User = require("../models/User");

let io;
const callSessions = new Map();
const LIVE_CALL_STATUSES = ["started", "arrived"];

function makeCallId() {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function configureRealtime(server) {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);
    socket.on("call:initiate", (payload, callback) => {
      void initiateCall(socket, payload, callback);
    });
    socket.on("call:support", (_payload, callback) => {
      void initiateSupportCall(socket, callback);
    });
    socket.on("call:respond", (payload, callback) => {
      void respondToCall(socket, payload, callback);
    });
    socket.on("call:end", (payload, callback) => {
      void endCall(socket, payload, callback);
    });
    socket.on("call:signal", (payload, callback) => {
      relayCallSignal(socket, payload, callback);
    });
  });

  return io;
}

async function initiateSupportCall(socket, callback) {
  try {
    const caller = await User.findById(socket.user.id).select("name email phone role").lean();
    if (!caller) return acknowledge(callback, { ok: false, message: "Account not found" });

    const adminSockets = await io.in("role:admin").fetchSockets();
    const adminIds = [...new Set(adminSockets.map((adminSocket) => String(adminSocket.user?.id || "")).filter((id) => id && id !== String(socket.user.id)))];
    if (!adminIds.length) {
      return acknowledge(callback, { ok: false, message: "No Watchtower admin is online right now. Please submit a ticket or try again shortly." });
    }

    const admins = await User.find({ _id: { $in: adminIds } }).select("name email phone role").lean();
    const adminLookup = new Map(admins.map((admin) => [String(admin._id), admin]));
    const callerName = caller.name || caller.email || caller.phone || "Support caller";
    const now = new Date();
    const session = {
      id: makeCallId(),
      bookingId: "",
      target: "support",
      callerId: String(socket.user.id),
      callerName,
      participants: adminIds,
      acceptedBy: [],
      createdAt: now.toISOString(),
      bookingLabel: `Support call from ${callerName}`,
    };
    const log = await CallLog.create({
      callSessionId: session.id,
      source: "support",
      target: "support",
      bookingLabel: session.bookingLabel,
      initiatedBy: caller._id,
      initiatedByRole: caller.role,
      initiatedBySnapshot: userSnapshot(caller),
      participants: adminIds.map((userId) => participantSnapshot(adminLookup.get(userId), "Watchtower admin")),
      status: "ringing",
      ringStartedAt: now,
    });
    session.logId = String(log._id);
    callSessions.set(session.id, session);

    const ringPayload = serializeCallSession(session, "ringing");
    adminIds.forEach((userId) => io?.to(`user:${userId}`).emit("call:ring", ringPayload));
    io?.to(`user:${session.callerId}`).emit("call:started", ringPayload);
    acknowledge(callback, { ok: true, call: ringPayload, message: "Watchtower is ringing" });
  } catch (error) {
    console.error("Support call initiate failed:", error.message);
    acknowledge(callback, { ok: false, message: "Could not start support call" });
  }
}

async function initiateCall(socket, payload = {}, callback) {
  try {
    if (socket.user.role !== "admin") return acknowledge(callback, { ok: false, message: "Only watchtower admins can initiate booking calls" });

    const bookingId = String(payload.bookingId || "");
    const target = String(payload.target || "");
    if (!["driver", "employer", "conference"].includes(target)) {
      return acknowledge(callback, { ok: false, message: "Choose driver, employer, or conference" });
    }

    const booking = await Booking.findById(bookingId)
      .populate("user", "name email phone")
      .populate({ path: "driver", populate: { path: "user", select: "name email phone" } });
    if (!booking) return acknowledge(callback, { ok: false, message: "Booking not found" });
    if (!LIVE_CALL_STATUSES.includes(booking.status)) {
      return acknowledge(callback, { ok: false, message: "Calls can only be started for active live trips" });
    }

    const participantIds = [];
    const participantSnapshots = [];
    const participantLabels = [];
    const employerId = booking.user?._id ? String(booking.user._id) : "";
    const driverId = booking.driver?.user?._id ? String(booking.driver.user._id) : "";
    if ((target === "employer" || target === "conference") && employerId) {
      participantIds.push(employerId);
      participantSnapshots.push(participantSnapshot(booking.user, "Employer"));
      participantLabels.push("Employer");
    }
    if ((target === "driver" || target === "conference") && driverId) {
      participantIds.push(driverId);
      participantSnapshots.push(participantSnapshot(booking.driver.user, "Driver"));
      participantLabels.push("Driver");
    }
    if (!participantIds.length) return acknowledge(callback, { ok: false, message: "No callable participant found for this booking" });

    const caller = await User.findById(socket.user.id).select("name email phone role").lean();
    const now = new Date();
    const session = {
      id: makeCallId(),
      bookingId,
      target,
      callerId: String(socket.user.id),
      callerName: caller?.name || caller?.email || socket.user.name || socket.user.email || "Watchtower",
      participants: participantIds,
      acceptedBy: [],
      createdAt: now.toISOString(),
      bookingLabel: `${booking.user?.name || booking.user?.email || "Employer"} to ${booking.driver?.name || booking.driver?.user?.name || "Chauffeur"}`,
    };
    const log = await CallLog.create({
      callSessionId: session.id,
      source: "booking",
      target,
      booking: booking._id,
      bookingLabel: session.bookingLabel,
      initiatedBy: socket.user.id,
      initiatedByRole: caller?.role || socket.user.role,
      initiatedBySnapshot: userSnapshot(caller || socket.user),
      participants: participantSnapshots,
      status: "ringing",
      ringStartedAt: now,
    });
    session.logId = String(log._id);
    callSessions.set(session.id, session);

    const ringPayload = serializeCallSession(session, "ringing");
    participantIds.forEach((userId) => io?.to(`user:${userId}`).emit("call:ring", ringPayload));
    io?.to(`user:${session.callerId}`).emit("call:started", ringPayload);
    acknowledge(callback, { ok: true, call: ringPayload, message: `${participantLabels.join(" and ")} ringing` });
  } catch (error) {
    console.error("Call initiate failed:", error.message);
    acknowledge(callback, { ok: false, message: "Could not start call" });
  }
}

async function respondToCall(socket, payload = {}, callback) {
  const session = callSessions.get(String(payload.sessionId || ""));
  if (!session) return acknowledge(callback, { ok: false, message: "Call no longer available" });
  const userId = String(socket.user.id);
  if (!session.participants.includes(userId)) return acknowledge(callback, { ok: false, message: "You are not part of this call" });

  const accepted = Boolean(payload.accepted);
  const now = new Date();
  if (accepted && !session.acceptedBy.includes(userId)) {
    session.acceptedBy.push(userId);
    if (!session.startedAt) session.startedAt = now.toISOString();
  }
  await recordCallResponse(session, userId, accepted, now);
  const event = {
    sessionId: session.id,
    bookingId: session.bookingId,
    userId,
    accepted,
    at: now.toISOString(),
  };
  io?.to(`user:${session.callerId}`).emit("call:participant-response", event);
  session.participants.forEach((participantId) => {
    io?.to(`user:${participantId}`).emit("call:participant-response", event);
  });
  acknowledge(callback, { ok: true, call: serializeCallSession(session, accepted ? "accepted" : "declined") });
}

async function endCall(socket, payload = {}, callback) {
  const session = callSessions.get(String(payload.sessionId || ""));
  if (!session) return acknowledge(callback, { ok: true });
  const userId = String(socket.user.id);
  const canEnd = userId === session.callerId || session.participants.includes(userId);
  if (!canEnd) return acknowledge(callback, { ok: false, message: "You are not part of this call" });

  const now = new Date();
  await recordCallEnded(session, userId, now);
  const event = { sessionId: session.id, bookingId: session.bookingId, endedBy: userId, at: now.toISOString() };
  io?.to(`user:${session.callerId}`).emit("call:ended", event);
  session.participants.forEach((participantId) => io?.to(`user:${participantId}`).emit("call:ended", event));
  callSessions.delete(session.id);
  acknowledge(callback, { ok: true });
}

function relayCallSignal(socket, payload = {}, callback) {
  const session = callSessions.get(String(payload.sessionId || ""));
  if (!session) return acknowledge(callback, { ok: false, message: "Call no longer available" });
  const fromUserId = String(socket.user.id);
  const allowed = fromUserId === session.callerId || session.participants.includes(fromUserId);
  if (!allowed) return acknowledge(callback, { ok: false, message: "You are not part of this call" });

  const toUserId = String(payload.toUserId || "");
  if (toUserId !== session.callerId && !session.participants.includes(toUserId)) {
    return acknowledge(callback, { ok: false, message: "Invalid call recipient" });
  }

  io?.to(`user:${toUserId}`).emit("call:signal", {
    sessionId: session.id,
    bookingId: session.bookingId,
    fromUserId,
    signal: payload.signal,
  });
  acknowledge(callback, { ok: true });
}

function serializeCallSession(session, state) {
  return {
    id: session.id,
    bookingId: session.bookingId,
    target: session.target,
    state,
    callerName: session.callerName,
    callerId: session.callerId,
    bookingLabel: session.bookingLabel,
    participantCount: session.participants.length,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
  };
}

function userSnapshot(user = {}) {
  return {
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
  };
}

function participantSnapshot(user = {}, label) {
  return {
    user: user?._id,
    role: label === "Driver" ? "driver" : label === "Employer" ? "user" : user?.role || "admin",
    label,
    ...userSnapshot(user),
  };
}

function serializeCallLog(log) {
  return {
    id: String(log._id),
    callSessionId: log.callSessionId,
    source: log.source,
    target: log.target,
    bookingId: log.booking ? String(log.booking) : "",
    bookingLabel: log.bookingLabel,
    status: log.status,
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    durationSeconds: log.durationSeconds || 0,
    participantCount: log.participants?.length || 0,
    createdAt: log.createdAt,
  };
}

function emitCallLogUpdated(log) {
  if (!log) return;
  io?.to("role:admin").emit("call:log-updated", serializeCallLog(log));
}

async function recordCallResponse(session, userId, accepted, at) {
  if (!session.logId) return;
  const log = await CallLog.findById(session.logId);
  if (!log) return;

  const participant = log.participants.find((item) => String(item.user || "") === userId);
  if (participant) {
    if (accepted && !participant.acceptedAt) participant.acceptedAt = at;
    if (!accepted && !participant.declinedAt) participant.declinedAt = at;
  }
  if (accepted) {
    if (!log.startedAt) log.startedAt = at;
    log.status = "active";
  } else if (!log.participants.some((item) => item.acceptedAt) && log.participants.every((item) => item.declinedAt)) {
    log.status = "declined";
    log.endedAt = at;
    log.durationSeconds = 0;
  }
  await log.save();
  emitCallLogUpdated(log);
}

async function recordCallEnded(session, endedBy, at) {
  if (!session.logId) return;
  const log = await CallLog.findById(session.logId);
  if (!log) return;

  log.endedAt = at;
  log.endedBy = endedBy;
  log.status = log.startedAt ? "ended" : "missed";
  const startedAt = log.startedAt || log.ringStartedAt || log.createdAt;
  const seconds = Math.max(0, Math.round((at.getTime() - new Date(startedAt).getTime()) / 1000));
  log.durationSeconds = Number.isFinite(seconds) ? seconds : 0;
  await log.save();
  emitCallLogUpdated(log);
}

function acknowledge(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

async function createNotification({ userId, type = "system", title, body, bookingId }) {
  if (!userId || !title || !body) return null;
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    body,
    booking: bookingId,
  });
  const payload = serializeNotification(notification);
  io?.to(`user:${userId}`).emit("notification:new", payload);
  return payload;
}

function emitBookingUpdate(booking, reason = "updated") {
  if (!booking) return;
  const payload = { bookingId: String(booking._id), status: booking.status, reason, at: new Date().toISOString() };
  if (booking.user) io?.to(`user:${booking.user._id || booking.user}`).emit("booking:updated", payload);
  if (booking.driver) io?.to(`user:${booking.driver.user?._id || booking.driver.user}`).emit("booking:updated", payload);
  io?.to("role:admin").emit("booking:updated", payload);
}

function serializeNotification(notification) {
  return {
    id: String(notification._id),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    bookingId: notification.booking ? String(notification.booking._id || notification.booking) : null,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt,
  };
}

module.exports = { configureRealtime, createNotification, emitBookingUpdate, serializeNotification };
