import { placeSessionWithRebalance } from './sessionSlot.js';

const SLOT_DURATION_MS = 60 * 60 * 1000;

/** Seans zamanı için yerel tarih string (YYYY-MM-DD). */
function localDateStr(ts) {
  const d = new Date(Number(ts));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Seans tarihi için uygun aktif paket bulur (tarih paket aralığında).
 * @returns {Promise<number|null>} member_package_id veya null
 */
export async function resolveMemberPackageId(db, memberId, startTs) {
  const dateStr = localDateStr(startTs);
  const packages = await db.query(
    `SELECT mp.id, mp.package_id, p.lesson_count
     FROM member_packages mp
     JOIN packages p ON p.id = mp.package_id
     WHERE mp.member_id = $1 AND mp.status = 'active'
       AND mp.start_date <= $2 AND mp.end_date >= $2
     ORDER BY mp.end_date ASC`,
    [memberId, dateStr]
  );
  if (packages.rows.length > 0) return packages.rows[0].id;
  return null;
}

/**
 * MP-03: Admin seans silme ve üye iptal — aynı mükerrer iptal + telafi parametreleri.
 * Aynı member_id + start_ts aktif kayıtlarının tamamını soft-delete eder;
 * ardından addNextSessionAfterLastForPackage(afterCancelTs, skipStartTs) çağırır.
 */
export async function cancelPackageSessionsAtSlot(db, {
  memberId,
  startTs,
  memberPackageId = null,
  deletedBy = null,
}) {
  const cancelRes = await db.query(
    `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $3
     WHERE member_id = $1 AND start_ts = $2 AND deleted_at IS NULL
     RETURNING id, member_package_id`,
    [memberId, startTs, deletedBy]
  );

  const cancelledIds = cancelRes.rows.map((r) => r.id);
  let mpId = memberPackageId;
  if (mpId == null) {
    mpId = cancelRes.rows.find((r) => r.member_package_id != null)?.member_package_id ?? null;
  }
  if (mpId == null && memberId != null && startTs != null) {
    mpId = await resolveMemberPackageId(db, memberId, startTs);
  }

  let replenished = { added: false };
  if (mpId != null) {
    replenished = await addNextSessionAfterLastForPackage(db, mpId, {
      afterCancelTs: startTs,
      skipStartTs: startTs,
    });
  }

  return { cancelledIds, replenished, memberPackageId: mpId };
}

/** DB date / ISO → yerel gün başlangıcı */
function toLocalDay(val) {
  if (val == null || val === '') return new Date(NaN);
  const s = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return new Date(NaN);
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 0, 0, 0, 0);
}

/**
 * Paketten seans silindiğinde bir telafi seansı ekler.
 * @param {object} [options]
 * @param {number} [options.afterCancelTs] — iptal edilen seansın start_ts; arama bu tarihten sonra da başlar
 * @param {number} [options.skipStartTs] — bu iptalin start_ts (ayrıca pakette daha önce iptal edilmiş tüm slotlar da atlanır)
 * @returns {Promise<{ added: boolean, sessionId?: number, reason?: string }>}
 */
export async function addNextSessionAfterLastForPackage(db, memberPackageId, options = {}) {
  try {
    const mp = await db.query(
      `SELECT mp.member_id, mp.start_date, mp.end_date, p.lesson_count
       FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1`,
      [memberPackageId]
    );
    if (mp.rows.length === 0) return { added: false, reason: 'package_not_found' };

    const { member_id, start_date, end_date, lesson_count } = mp.rows[0];
    const countRes = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
      [memberPackageId]
    );
    const count = countRes.rows[0]?.cnt ?? 0;
    if (count >= lesson_count) {
      return { added: false, reason: 'package_full' };
    }

    const lastRes = await db.query(
      'SELECT start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) ORDER BY start_ts DESC LIMIT 1',
      [memberPackageId]
    );

    const end = toLocalDay(end_date);
    end.setHours(23, 59, 59, 999);
    if (Number.isNaN(end.getTime())) {
      console.error('addNextSessionAfterLastForPackage: geçersiz end_date', end_date);
      return { added: false, reason: 'invalid_end_date' };
    }

    let startDay = toLocalDay(start_date);
    if (lastRes.rows.length > 0) {
      const lastDay = new Date(Number(lastRes.rows[0].start_ts));
      startDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1, 0, 0, 0, 0);
    }
    if (options.afterCancelTs != null) {
      const cancelDay = new Date(Number(options.afterCancelTs));
      const fromCancel = new Date(cancelDay.getFullYear(), cancelDay.getMonth(), cancelDay.getDate() + 1, 0, 0, 0, 0);
      if (!Number.isNaN(fromCancel.getTime()) && fromCancel.getTime() > startDay.getTime()) {
        startDay = fromCancel;
      }
    }
    if (Number.isNaN(startDay.getTime())) {
      return { added: false, reason: 'invalid_start' };
    }

    const slotsRes = await db.query(
      'SELECT day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1',
      [memberPackageId]
    );
    const slots = slotsRes.rows;
    if (slots.length === 0) {
      console.error('addNextSessionAfterLastForPackage: slot yok, mp=', memberPackageId);
      return { added: false, reason: 'no_slots' };
    }

    const cancelledRes = await db.query(
      `SELECT DISTINCT start_ts FROM sessions
       WHERE member_package_id = $1 AND deleted_at IS NOT NULL`,
      [memberPackageId]
    );
    const cancelledStartTs = new Set(
      cancelledRes.rows.map((r) => Number(r.start_ts)).filter((ts) => Number.isFinite(ts))
    );
    if (options.skipStartTs != null) {
      cancelledStartTs.add(Number(options.skipStartTs));
    }

    for (let d = new Date(startDay.getTime()); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      for (const slot of slots) {
        if (Number(slot.day_of_week) !== dayOfWeek) continue;
        const timeStr = String(slot.start_time || '08:00');
        const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
        // buildPackageSessionInsertPlan ile tutarlı: Türkiye saati (+03:00) kullan
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`);
        const startTs = slotStart.getTime();
        const endTs = startTs + SLOT_DURATION_MS;

        if (cancelledStartTs.has(startTs)) continue;

        const dup = await db.query(
          `SELECT id FROM sessions
           WHERE member_package_id = $1 AND member_id = $2 AND start_ts = $3 AND (deleted_at IS NULL)
           LIMIT 1`,
          [memberPackageId, member_id, startTs]
        );
        if (dup.rows.length > 0) continue;

        const placed = await placeSessionWithRebalance(db, {
          staffId: slot.staff_id,
          startTs,
          endTs,
          memberId: member_id,
          memberPackageId,
        });
        if (!placed.ok) continue;

        return { added: true, sessionId: placed.sessionId };
      }
    }

    console.error('addNextSessionAfterLastForPackage: uygun gün bulunamadı', {
      memberPackageId,
      startDay: startDay.toISOString(),
      end: end.toISOString(),
      count,
      lesson_count,
    });
    return { added: false, reason: 'no_available_slot' };
  } catch (err) {
    console.error('addNextSessionAfterLastForPackage error:', err);
    return { added: false, reason: 'error' };
  }
}
