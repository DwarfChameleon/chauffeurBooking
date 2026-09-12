const express = require("express");
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const { getIceServers, listCallHistory } = require("../controllers/callController");

const router = express.Router();

router.get("/ice-servers", auth, getIceServers);
router.get("/history", auth, admin, listCallHistory);

module.exports = router;
