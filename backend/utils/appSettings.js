import db from '../config/database.js';

const INSTITUTION_WHATSAPP_KEY = 'institution_whatsapp';
const STAFF_CALENDAR_RANGE_KEY = 'staff_calendar_range';

export async function getInstitutionWhatsApp() {
  try {
    const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [INSTITUTION_WHATSAPP_KEY]);
    const v = res.rows[0]?.value;
    if (v != null && String(v).trim()) {
      return String(v).trim().replace(/\D/g, '');
    }
  } catch (err) {
    if (err.code === '42P01') {
      const env = process.env.INSTITUTION_WHATSAPP;
      return env ? String(env).replace(/\D/g, '') : null;
    }
    throw err;
  }
  const env = process.env.INSTITUTION_WHATSAPP;
  return env ? String(env).replace(/\D/g, '') : null;
}

export async function getStaffCalendarRange() {
  try {
    const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [STAFF_CALENDAR_RANGE_KEY]);
    if (res.rows[0]?.value) {
      const parsed = JSON.parse(res.rows[0].value);
      return { daysBefore: Number(parsed.daysBefore) || 0, daysAfter: Number(parsed.daysAfter) || 0 };
    }
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  return null;
}

export async function setStaffCalendarRange(daysBefore, daysAfter) {
  const value = JSON.stringify({ daysBefore: Number(daysBefore), daysAfter: Number(daysAfter) });
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [STAFF_CALENDAR_RANGE_KEY, value]
  );
}

export async function clearStaffCalendarRange() {
  await db.query('DELETE FROM app_settings WHERE key = $1', [STAFF_CALENDAR_RANGE_KEY]);
}

export async function setInstitutionWhatsApp(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 15) {
    const err = new Error('INVALID_WHATSAPP');
    err.code = 'INVALID_WHATSAPP';
    throw err;
  }
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [INSTITUTION_WHATSAPP_KEY, digits]
  );
  return digits;
}
