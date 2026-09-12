const Notification = require("../models/Notification");
const SupportTicket = require("../models/SupportTicket");
const User = require("../models/User");

const SUPPORT_CATEGORIES = new Set([
  "booking_issue",
  "payment_issue",
  "account_login",
  "driver_verification",
  "safety_concern",
  "app_bug",
  "other",
]);

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function createTicketNumber() {
  const time = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BJ-${time}-${suffix}`;
}

function priorityFor(category) {
  if (category === "safety_concern") return "urgent";
  if (category === "booking_issue" || category === "payment_issue") return "high";
  return "normal";
}

function serializeTicket(ticket) {
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    userId: ticket.user ? String(ticket.user._id || ticket.user) : "",
    role: ticket.role,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    bookingReference: ticket.bookingReference || "",
    priority: ticket.priority,
    status: ticket.status,
    contactSnapshot: ticket.contactSnapshot || {},
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

async function notifyAdmins(ticket, user) {
  const admins = await User.find({ role: "admin", adminStatus: { $ne: "deactivated" } }).select("_id").lean();
  if (!admins.length) return;

  await Notification.insertMany(admins.map((admin) => ({
    user: admin._id,
    type: "system",
    title: "New support request",
    body: `${user.name || user.email || user.phone || "A user"} submitted ${ticket.ticketNumber}.`,
  })));
}

exports.createSupportTicket = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email phone role").lean();
    if (!user) return res.status(404).json({ message: "Account not found" });

    const category = clean(req.body.category, 60);
    const subject = clean(req.body.subject, 140);
    const message = clean(req.body.message, 2000);
    const bookingReference = clean(req.body.bookingReference, 80);

    if (!SUPPORT_CATEGORIES.has(category)) {
      return res.status(400).json({ message: "Choose a valid support category." });
    }
    if (!subject || subject.length < 4) {
      return res.status(400).json({ message: "Add a short subject for this request." });
    }
    if (!message || message.length < 12) {
      return res.status(400).json({ message: "Tell us a little more about the issue." });
    }

    const ticket = await SupportTicket.create({
      ticketNumber: createTicketNumber(),
      user: user._id,
      role: user.role,
      category,
      subject,
      message,
      bookingReference,
      priority: priorityFor(category),
      contactSnapshot: {
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      },
    });

    notifyAdmins(ticket, user).catch((error) => {
      console.error("Support admin notification failed:", error.message);
    });

    res.status(201).json({
      message: "Support request submitted. Our team will follow up soon.",
      ticket: serializeTicket(ticket),
    });
  } catch (error) {
    console.error("Create support ticket failed:", error.message);
    res.status(500).json({ message: "Could not submit support request" });
  }
};

exports.listMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ tickets: tickets.map(serializeTicket) });
  } catch (error) {
    console.error("List support tickets failed:", error.message);
    res.status(500).json({ message: "Could not load support requests" });
  }
};

exports.listAllSupportTickets = async (_req, res) => {
  try {
    const tickets = await SupportTicket.find({})
      .sort({ createdAt: -1 })
      .limit(120)
      .populate("user", "name email phone role")
      .lean();
    res.json({ tickets: tickets.map(serializeTicket) });
  } catch (error) {
    console.error("List admin support tickets failed:", error.message);
    res.status(500).json({ message: "Could not load support requests" });
  }
};
