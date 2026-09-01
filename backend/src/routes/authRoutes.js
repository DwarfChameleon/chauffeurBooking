const express = require("express");
const multer = require("multer");
const { register,login } = require("../controllers/authController");
const router = express.Router();

// Set up multer storage (optional: adjust destination & filename as needed)
const storage = multer.memoryStorage(); // use memory storage for now
const upload = multer({ storage });

// Use multer to handle multipart/form-data for register
router.post("/register", upload.single("photo") ,register);
router.post("/login", login); 

module.exports = router;
