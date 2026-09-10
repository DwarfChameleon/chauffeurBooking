const express = require("express");
const auth = require("../middleware/authMiddleware");
const { getIceServers } = require("../controllers/callController");

const router = express.Router();

router.get("/ice-servers", auth, getIceServers);

module.exports = router;
