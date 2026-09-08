const superAdminMiddleware = (req, res, next) => {
  if (!req.admin || req.admin.adminLevel !== "super") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
};

module.exports = superAdminMiddleware;
