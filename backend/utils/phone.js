/**
 * Telefon formatı: (xxx)xxx-xx-xx — 10 hane
 * Örnek: (532)123-45-67
 */

const PHONE_DIGITS = 10;
const PHONE_REGEX = /^\(\d{3}\)\d{3}-\d{2}-\d{2}$/;

/**
 * Sadece rakamları alır, 10 hane ise (xxx)xxx-xx-xx formatında döner.
 * @param {string} raw
 * @returns {string|null} Formatlanmış telefon veya null
 */
export function normalizePhone(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '').slice(0, PHONE_DIGITS);
  if (digits.length !== PHONE_DIGITS) return null;
  return formatPhone(digits);
}

/**
 * 10 haneli rakam dizisini (xxx)xxx-xx-xx formatına çevirir.
 * @param {string} digits — 10 karakter
 */
export function formatPhone(digits) {
  const d = String(digits).replace(/\D/g, '').slice(0, PHONE_DIGITS);
  if (d.length !== PHONE_DIGITS) return null;
  return `(${d.slice(0, 3)})${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/**
 * Zaten (xxx)xxx-xx-xx formatında mı kontrol eder.
 */
export function isValidPhoneFormat(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length === PHONE_DIGITS;
}

/**
 * Herhangi bir girişi (xxx)xxx-xx-xx formatına çevirir.
 * Geçersizse null döner.
 */
export function toPhoneFormat(value) {
  if (value == null || value === '') return null;
  return normalizePhone(String(value));
}
