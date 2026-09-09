const express = require("express");
const auth = require("../middleware/authMiddleware");
const { createSupportTicket, listMySupportTickets } = require("../controllers/supportController");

const router = express.Router();

router.get("/tickets", auth, listMySupportTickets);
router.post("/tickets", auth, createSupportTicket);

module.exports = router;
