const NIGERIA_PHONE_ERROR = "Enter a valid Nigerian phone number, e.g. 08031234567 or +2348031234567.";

function normalizeNigeriaPhone(value = "") {
  return String(value).replace(/[\s-]/g, "");
}

function isValidNigeriaPhone(value) {
  const phone = normalizeNigeriaPhone(value);
  if (!phone) return true;
  return /^(0[789][01]\d{8}|\+234[789][01]\d{8}|234[789][01]\d{8})$/.test(phone);
}

module.exports = { NIGERIA_PHONE_ERROR, isValidNigeriaPhone, normalizeNigeriaPhone };
