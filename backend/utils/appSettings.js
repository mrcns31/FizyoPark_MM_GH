import db from '../config/database.js';

const INSTITUTION_WHATSAPP_KEY = 'institution_whatsapp';

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
