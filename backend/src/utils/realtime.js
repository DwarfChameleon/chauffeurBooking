const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
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
      respondToCall(socket, payload, callback);
    });
    socket.on("call:end", (payload, callback) => {
      endCall(socket, payload, callback);
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

    const callerName = caller.name || caller.email || caller.phone || "Support caller";
    const session = {
      id: makeCallId(),
      bookingId: "",
      target: "support",
      callerId: String(socket.user.id),
      callerName,
      participants: adminIds,
      acceptedBy: [],
      createdAt: new Date().toISOString(),
      bookingLabel: `Support call from ${callerName}`,
    };
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
    const participantLabels = [];
    const employerId = booking.user?._id ? String(booking.user._id) : "";
    const driverId = booking.driver?.user?._id ? String(booking.driver.user._id) : "";
    if ((target === "employer" || target === "conference") && employerId) {
      participantIds.push(employerId);
      participantLabels.push("Employer");
    }
    if ((target === "driver" || target === "conference") && driverId) {
      participantIds.push(driverId);
      participantLabels.push("Driver");
    }
    if (!participantIds.length) return acknowledge(callback, { ok: false, message: "No callable participant found for this booking" });

    const session = {
      id: makeCallId(),
      bookingId,
      target,
      callerId: String(socket.user.id),
      callerName: socket.user.name || socket.user.email || "Watchtower",
      participants: participantIds,
      acceptedBy: [],
      createdAt: new Date().toISOString(),
      bookingLabel: `${booking.user?.name || booking.user?.email || "Employer"} to ${booking.driver?.name || booking.driver?.user?.name || "Chauffeur"}`,
    };
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

function respondToCall(socket, payload = {}, callback) {
  const session = callSessions.get(String(payload.sessionId || ""));
  if (!session) return acknowledge(callback, { ok: false, message: "Call no longer available" });
  const userId = String(socket.user.id);
  if (!session.participants.includes(userId)) return acknowledge(callback, { ok: false, message: "You are not part of this call" });

  const accepted = Boolean(payload.accepted);
  if (accepted && !session.acceptedBy.includes(userId)) session.acceptedBy.push(userId);
  const event = {
    sessionId: session.id,
    bookingId: session.bookingId,
    userId,
    accepted,
    at: new Date().toISOString(),
  };
  io?.to(`user:${session.callerId}`).emit("call:participant-response", event);
  session.participants.forEach((participantId) => {
    io?.to(`user:${participantId}`).emit("call:participant-response", event);
  });
  acknowledge(callback, { ok: true, call: serializeCallSession(session, accepted ? "accepted" : "declined") });
}

function endCall(socket, payload = {}, callback) {
  const session = callSessions.get(String(payload.sessionId || ""));
  if (!session) return acknowledge(callback, { ok: true });
  const userId = String(socket.user.id);
  const canEnd = userId === session.callerId || session.participants.includes(userId);
  if (!canEnd) return acknowledge(callback, { ok: false, message: "You are not part of this call" });

  const event = { sessionId: session.id, bookingId: session.bookingId, endedBy: userId, at: new Date().toISOString() };
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
  };
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
