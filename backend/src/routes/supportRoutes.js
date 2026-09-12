const express = require("express");
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { createSupportTicket, listAllSupportTickets, listMySupportTickets } = require("../controllers/supportController");

const router = express.Router();

router.get("/tickets", auth, listMySupportTickets);
router.get("/admin/tickets", auth, admin, listAllSupportTickets);
router.post("/tickets", auth, createSupportTicket);

module.exports = router;
