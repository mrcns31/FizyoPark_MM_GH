import { resolveLocalDateRangeMs } from './staffWorkingHours.js';
import { CHECK_IN_EARLY_MS, CHECK_IN_LATE_MS, autoCompletePackageIfExhausted } from './packageSessionCounts.js';

const DEBOUNCE_SECONDS = 30;

/** Randevusuz kapı girişi kaydı (üye) — son 30 sn içinde aynı üye tekrar kaydedilmez. */
export async function logWalkInQrAccess(db, memberId, source = 'qr') {
  if (!memberId) return false;
  try {
    // Son 30 sn içinde bu üyeden zaten check-in (activity_logs) veya walk-in (facility_access_logs) var mı?
    const [recentActivity, recentWalkIn] = await Promise.all([
      db.query(
        `SELECT id FROM activity_logs
         WHERE action = 'session.check_in_qr'
           AND (details->>'memberId')::text = $1::text
           AND created_at >= NOW() - INTERVAL '${DEBOUNCE_SECONDS} seconds'
         LIMIT 1`,
        [memberId]
      ).catch(() => ({ rows: [] })),
      db.query(
        `SELECT id FROM facility_access_logs
         WHERE member_id = $1
           AND accessed_at >= NOW() - INTERVAL '${DEBOUNCE_SECONDS} seconds'
         LIMIT 1`,
        [memberId]
      ).catch(() => ({ rows: [] })),
    ]);

    if (recentActivity.rows.length > 0 || recentWalkIn.rows.length > 0) {
      return false; // çok yakın zamanda zaten loglandı, tekrar kaydetme
    }

    await db.query(
      `INSERT INTO facility_access_logs (member_id, accessed_at, source)
       VALUES ($1, CURRENT_TIMESTAMP, $2)`,
      [memberId, source]
    );
    return true;
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('[facilityAccess] facility_access_logs tablosu yok; migration_facility_access_logs.sql çalıştırın');
    } else {
      console.error('[facilityAccess] walk-in log hatası:', err.message);
    }
    return false;
  }
}

/** Personel kapı girişi kaydı */
export async function logStaffAccess(db, staffId, source = 'phone') {
  if (!staffId) return false;
  try {
    await db.query(
      `INSERT INTO facility_access_logs (staff_id, accessed_at, source)
       VALUES ($1, CURRENT_TIMESTAMP, $2)`,
      [staffId, source]
    );
    return true;
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('[facilityAccess] facility_access_logs tablosu yok; migration_facility_access_logs.sql çalıştırın');
    } else {
      console.error('[facilityAccess] personel giriş log hatası:', err.message);
    }
    return false;
  }
}

/** Seçilen tarih aralığındaki randevusuz QR girişleri */
export async function listWalkInAccessForDate(db, opts = {}) {
  const { start, end } = resolveLocalDateRangeMs(typeof opts === 'string' ? { dateStr: opts } : opts);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  try {
    const res = await db.query(
      `SELECT fal.id,
              fal.member_id,
              fal.staff_id,
              fal.source,
              EXTRACT(EPOCH FROM fal.accessed_at) * 1000 AS accessed_ts,
              COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
              m.member_no,
              TRIM(s.first_name || ' ' || s.last_name) AS staff_name
       FROM facility_access_logs fal
       LEFT JOIN members m ON m.id = fal.member_id
       LEFT JOIN staff s ON s.id = fal.staff_id
       WHERE fal.accessed_at >= to_timestamp($1 / 1000.0)
         AND fal.accessed_at <= to_timestamp($2 / 1000.0)
       ORDER BY fal.accessed_at ASC`,
      [start, end]
    );
    return res.rows.map((row) => ({
      id: row.id,
      memberId: row.member_id || null,
      staffId: row.staff_id || null,
      memberName: row.member_name || row.staff_name || '',
      memberNo: row.member_no || (row.staff_id ? 'Personel' : ''),
      isStaff: !!row.staff_id,
      accessedAt: Math.round(Number(row.accessed_ts)),
      source: row.source || 'qr',
      label: row.source === 'phone' ? 'Telefon' : row.source === 'card' ? 'Kart' : 'QR',
    }));
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('[facilityAccess] facility_access_logs tablosu yok');
      return [];
    }
    throw err;
  }
}

/**
 * Seans oluşturulduğunda ya da güncellediğinde, zaman penceresinde bu üyeye ait
 * randevusuz walk-in girişi varsa seansı otomatik "geldi" olarak işaretler.
 * Zaten fiziksel girişi olan seansları dokunmaz.
 * Returns: true if matched and updated, false otherwise
 */
export async function matchWalkInToSession(db, sessionId) {
  try {
    const sessionRes = await db.query(
      `SELECT id, member_id, start_ts, end_ts, member_package_id, checked_in_at, check_in_method
       FROM sessions WHERE id = $1 AND deleted_at IS NULL`,
      [sessionId]
    );
    if (sessionRes.rows.length === 0) return false;
    const session = sessionRes.rows[0];
    if (!session.member_id) return false;

    // Zaten fiziksel (QR/kart/telefon) girişi varsa dokunma
    const PHYSICAL_METHODS = ['qr', 'phone', 'card'];
    if (session.checked_in_at != null && PHYSICAL_METHODS.includes(session.check_in_method)) return false;

    const startTs = Number(session.start_ts);
    const endTs = Number(session.end_ts);
    const windowStart = startTs - CHECK_IN_EARLY_MS;
    const windowEnd = endTs + CHECK_IN_LATE_MS;

    const walkInRes = await db.query(
      `SELECT id, source, EXTRACT(EPOCH FROM accessed_at) * 1000 AS accessed_ts
       FROM facility_access_logs
       WHERE member_id = $1
         AND accessed_at >= to_timestamp($2 / 1000.0)
         AND accessed_at <= to_timestamp($3 / 1000.0)
       ORDER BY ABS(EXTRACT(EPOCH FROM accessed_at) * 1000 - $4) ASC
       LIMIT 1`,
      [session.member_id, windowStart, windowEnd, startTs]
    );
    if (walkInRes.rows.length === 0) return false;

    const walkIn = walkInRes.rows[0];
    const result = await db.query(
      `UPDATE sessions
       SET checked_in_at = to_timestamp($2 / 1000.0),
           check_in_method = $3,
           attendance_outcome = 'present',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND (checked_in_at IS NULL OR check_in_method NOT IN ('qr', 'phone', 'card'))
       RETURNING id`,
      [sessionId, Number(walkIn.accessed_ts), walkIn.source]
    );
    if (result.rows.length === 0) return false;

    if (session.member_package_id) {
      await autoCompletePackageIfExhausted(db, session.member_package_id).catch(() => {});
    }
    return true;
  } catch (err) {
    if (err.code === '42P01') return false;
    console.error('[facilityAccess] matchWalkInToSession hatası:', err.message);
    return false;
  }
}
