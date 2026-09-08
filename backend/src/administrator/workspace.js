const ADMIN_WORKSPACE = {
  appName: "BJED Chauffeur",
  role: "admin",
  landingRoute: "/admin/dashboard",
  pages: [
    { key: "dashboard", label: "Dashboard", route: "/admin/dashboard", icon: "grid-outline" },
    { key: "profile", label: "Admin Profile", route: "/admin/profile", icon: "person-circle-outline" },
    { key: "users", label: "Users", route: "/admin/users", icon: "people-outline" },
    { key: "employers", label: "Employers", route: "/admin/employers", icon: "business-outline" },
    { key: "drivers", label: "Drivers", route: "/admin/drivers", icon: "car-sport-outline" },
    { key: "bookings", label: "Bookings", route: "/admin/bookings", icon: "calendar-outline" },
    { key: "verification", label: "Verification", route: "/admin/verification", icon: "shield-checkmark-outline" },
    { key: "notifications", label: "Notifications", route: "/admin/notifications", icon: "notifications-outline" },
  ],
  permissions: [
    "view-dashboard",
    "manage-users",
    "manage-drivers",
    "manage-bookings",
    "verify-documents",
    "view-notifications",
  ],
};

function serializeAdminProfile(user) {
  return {
    id: user._id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    adminLevel: user.adminLevel || "standard",
    adminStatus: user.adminStatus || "active",
    canManageAdmins: user.adminLevel === "super" && user.adminStatus !== "deactivated",
    initials: initialsFor(user.name || user.email || user.phone || "Admin"),
    workspace: ADMIN_WORKSPACE,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function initialsFor(value) {
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";
}

module.exports = {
  ADMIN_WORKSPACE,
  serializeAdminProfile,
};
