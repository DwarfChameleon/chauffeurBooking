require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const driverRoutes = require("./routes/driverRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const employerRoutes = require("./routes/employerRoutes");

const app = express();

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const defaultAllowedOrigins = [
  "http://127.0.0.1:4200",
  "http://localhost:4200",
  "http://127.0.0.1:8100",
  "http://localhost:8100",
];

const allowedOrigins = (process.env.CORS_ORIGINS || defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}):(4200|808\d)$/.test(origin) ||
  /^exp:\/\/(localhost|127\.0\.0\.1|(?:\d{1,3}\.){3}\d{1,3}):808\d$/.test(origin);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Connection Error:", err));

app.get("/", (req, res) => {
  res.send("API is running...");
});
app.use("/api/drivers", driverRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employers", employerRoutes);

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
