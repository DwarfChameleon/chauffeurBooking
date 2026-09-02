const express = require("express");
const auth = require("../middleware/authMiddleware");
const { resolveRoute, resolvePlace } = require("../controllers/locationController");

const router = express.Router();

router.post("/route", auth, resolveRoute);
router.get("/place", auth, resolvePlace);

module.exports = router;
