import { cancelPackageSessionsAtSlot } from './packageSessions.js';
import { dayStartMs, dayEndMs } from './staffWorkingHours.js';

const MAX_RESCHEDULE_ITERATIONS = 500;

/** İki YYYY-MM-DD tarihi arasındaki gün sayısı (kapsayıcı, örn. 22-31 Mayıs = 10). */
export function dayCountInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

function closurePeriodToDto(row) {
  return {
    id: row.id,
    startDate: String(row.start_date).slice(0, 10),
    endDate: String(row.end_date).slice(0, 10),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Kapanış dönemi kaydeder; tüm aktif paketlerin bitiş tarihini uzatır ve
 * kapanış aralığındaki seansları iptal/yeniden planlama ile ileri tarihe alır.
 * @returns {Promise<{ closurePeriod: object, summary: { dayCount: number, extendedPackageCount: number, rescheduledCount: number, cancelledOnlyCount: number } }>}
 */
export async function applyClosurePeriod(db, { startDate, endDate, description, createdBy }) {
  const inserted = await db.query(
    `INSERT INTO closure_periods (start_date, end_date, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, start_date::text, end_date::text, description, created_by, created_at`,
    [startDate, endDate, description, createdBy]
  );
  const closurePeriod = inserted.rows[0];
  const dayCount = dayCountInclusive(startDate, endDate);

  const extendRes = await db.query(
    `UPDATE member_packages SET end_date = end_date + $1::int, updated_at = CURRENT_TIMESTAMP
     WHERE status = 'active'
     RETURNING id`,
    [dayCount]
  );
  const extendedPackageCount = extendRes.rows.length;

  const rangeStart = dayStartMs(startDate);
  const rangeEnd = dayEndMs(endDate);

  let rescheduledCount = 0;
  let cancelledOnlyCount = 0;

  for (let i = 0; i < MAX_RESCHEDULE_ITERATIONS; i++) {
    const next = await db.query(
      `SELECT id, member_id, member_package_id, start_ts FROM sessions
       WHERE deleted_at IS NULL AND start_ts >= $1 AND start_ts <= $2
       ORDER BY start_ts ASC LIMIT 1`,
      [rangeStart, rangeEnd]
    );
    if (next.rows.length === 0) break;

    const row = next.rows[0];
    const startTs = Number(row.start_ts);

    if (row.member_package_id != null) {
      const result = await cancelPackageSessionsAtSlot(db, {
        memberId: row.member_id,
        startTs,
        memberPackageId: row.member_package_id,
        deletedBy: createdBy,
      });
      if (result.replenished && result.replenished.added) {
        rescheduledCount += 1;
      } else {
        cancelledOnlyCount += 1;
      }
    } else {
      await db.query(
        `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2 WHERE id = $1`,
        [row.id, createdBy]
      );
      cancelledOnlyCount += 1;
    }

    if (i === MAX_RESCHEDULE_ITERATIONS - 1) {
      console.error('applyClosurePeriod: iterasyon sınırına ulaşıldı', { closurePeriodId: closurePeriod.id });
    }
  }

  return {
    closurePeriod: closurePeriodToDto(closurePeriod),
    summary: { dayCount, extendedPackageCount, rescheduledCount, cancelledOnlyCount },
  };
}

/** Tüm kapanış dönemlerini en yeniden eskiye listeler. */
export async function listClosurePeriods(db) {
  const res = await db.query(
    `SELECT id, start_date::text, end_date::text, description, created_by, created_at
     FROM closure_periods ORDER BY created_at DESC`
  );
  return res.rows.map(closurePeriodToDto);
}

/** Kapanış kaydını siler. Daha önce uygulanan seans kaydırma/paket uzatma etkileri geri alınmaz. */
export async function deleteClosurePeriod(db, id) {
  const res = await db.query('DELETE FROM closure_periods WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}
