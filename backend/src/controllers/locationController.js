const { resolveRoute, resolvePlace } = require("../utils/locationService");

exports.resolveRoute = async (req, res) => {
  try {
    const route = await resolveRoute(req.body || {});
    res.json(route);
  } catch {
    res.status(500).json({ message: "Could not resolve route locations" });
  }
};

exports.resolvePlace = async (req, res) => {
  try {
    const place = await resolvePlace(req.query.q || "", req.query.context || "");
    if (!place) return res.status(404).json({ message: "Location not found" });
    res.json(place);
  } catch {
    res.status(500).json({ message: "Could not resolve location" });
  }
};
