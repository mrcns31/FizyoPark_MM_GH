import { resolveLocalDateRangeMs } from './staffWorkingHours.js';

/** Randevusuz kapı QR geçişi kaydı */
export async function logWalkInQrAccess(db, memberId) {
  if (!memberId) return false;
  try {
    await db.query(
      `INSERT INTO facility_access_logs (member_id, accessed_at, source)
       VALUES ($1, CURRENT_TIMESTAMP, 'qr')`,
      [memberId]
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

/** Seçilen tarih aralığındaki randevusuz QR girişleri */
export async function listWalkInAccessForDate(db, opts = {}) {
  const { start, end } = resolveLocalDateRangeMs(typeof opts === 'string' ? { dateStr: opts } : opts);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  try {
    const res = await db.query(
      `SELECT fal.id,
              fal.member_id,
              EXTRACT(EPOCH FROM fal.accessed_at) * 1000 AS accessed_ts,
              COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
              m.member_no
       FROM facility_access_logs fal
       JOIN members m ON m.id = fal.member_id
       WHERE fal.accessed_at >= to_timestamp($1 / 1000.0)
         AND fal.accessed_at <= to_timestamp($2 / 1000.0)
       ORDER BY fal.accessed_at ASC, m.name ASC`,
      [start, end]
    );
    return res.rows.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name || '',
      memberNo: row.member_no || '',
      accessedAt: Math.round(Number(row.accessed_ts)),
      label: 'Randevusuz QR',
    }));
  } catch (err) {
    if (err.code === '42P01') {
      console.warn('[facilityAccess] facility_access_logs tablosu yok');
      return [];
    }
    throw err;
  }
}
