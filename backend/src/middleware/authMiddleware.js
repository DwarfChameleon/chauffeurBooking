const jwt = require("jsonwebtoken");
const LOGIN_AGAIN_MESSAGE = "Please log in again to continue.";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
    req.user = decoded; // Attach decoded user info to request
    next();
  } catch (err) {
    return res.status(401).json({ message: LOGIN_AGAIN_MESSAGE, code: "AUTH_EXPIRED" });
  }
};

module.exports = authMiddleware;
