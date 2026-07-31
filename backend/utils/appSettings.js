import db from '../config/database.js';

const INSTITUTION_WHATSAPP_KEY = 'institution_whatsapp';
const STAFF_CALENDAR_RANGE_KEY = 'staff_calendar_range';
const RATINGS_GO_LIVE_KEY = 'ratings_go_live_ts';
const PACKAGE_NOTIFY_GO_LIVE_KEY = 'package_notify_go_live_ts';

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

/**
 * Puanlama sisteminin devreye alındığı an (ms). Bu tarihten önce biten seanslar puanlanamaz.
 * Kayıt yoksa (migration henüz uygulanmamış) Infinity döner → hiçbir seans puanlanabilir sayılmaz.
 */
export async function getRatingsGoLiveTs() {
  try {
    const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [RATINGS_GO_LIVE_KEY]);
    const v = Number(res.rows[0]?.value);
    if (Number.isFinite(v)) return v;
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }
  return Infinity;
}

/**
 * Paket bildirimlerinin devreye alındığı an (ms).
 * Bu andan ÖNCEKİ durumlar bildirim tetiklemez — sistem açıldığında geçmişteki
 * tüm paketlere toplu bildirim gitmesini önler.
 * Kayıt yoksa ilk çağrıda `now` yazılır; o turda hiçbir bildirim gönderilmez.
 * Tablo yoksa Infinity döner → hiçbir bildirim gönderilmez.
 */
export async function getOrInitPackageNotifyGoLiveTs(now = Date.now()) {
  try {
    const res = await db.query('SELECT value FROM app_settings WHERE key = $1', [
      PACKAGE_NOTIFY_GO_LIVE_KEY,
    ]);
    const v = Number(res.rows[0]?.value);
    if (Number.isFinite(v)) return v;

    await db.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO NOTHING`,
      [PACKAGE_NOTIFY_GO_LIVE_KEY, String(now)]
    );
    console.log(`[appSettings] paket bildirimleri devreye alındı: ${new Date(now).toISOString()}`);
    return now;
  } catch (err) {
    if (err.code === '42P01') return Infinity;
    throw err;
  }
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
