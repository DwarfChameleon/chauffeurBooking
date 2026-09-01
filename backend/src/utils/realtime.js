const jwt = require("jsonwebtoken");
const Notification = require("../models/Notification");

let io;

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
  });

  return io;
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
