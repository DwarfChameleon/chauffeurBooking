export const NIGERIA_PHONE_ERROR = 'Enter a valid Nigerian phone number, e.g. 08031234567 or +2348031234567.';

export function normalizeNigeriaPhone(value: string) {
  return (value || '').replace(/[\s-]/g, '');
}

export function isValidNigeriaPhone(value: string) {
  const phone = normalizeNigeriaPhone(value);
  if (!phone) return true;
  return /^(0[789][01]\d{8}|\+234[789][01]\d{8}|234[789][01]\d{8})$/.test(phone);
}
