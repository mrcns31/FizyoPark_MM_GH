/** Seans iptal kilidi — bu süreden sonra iptal edilemez, seans bitince hak düşer */
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** Randevu saatinden kaç dk önce QR/telefon ile giriş kabul edilir */
export const CHECK_IN_EARLY_MS = 60 * 60 * 1000;

/** Seans bitişinden kaç dk sonraya kadar QR/telefon kabul edilir */
export const CHECK_IN_LATE_MS = 30 * 60 * 1000;

function normalizeSessionRow(row) {
  return {
    startTs: Number(row.start_ts ?? row.startTs),
    endTs: Number(row.end_ts ?? row.endTs),
    deletedAt: row.deleted_at ?? row.deletedAt ?? null,
    checkedInAt: row.checked_in_at ?? row.checkedInAt ?? null,
    attendanceOutcome: row.attendance_outcome ?? row.attendanceOutcome ?? null,
  };
}

/** Zamanında iptal (soft delete) → kullanım hakkından düşmez */
export function isSessionCancelled(row) {
  return normalizeSessionRow(row).deletedAt != null;
}

/**
 * Paket hakkından düşen seans:
 * - QR veya personel onayı ile giriş (checked_in_at dolu), veya
 * - Personel onayı ile gelmedi (attendance_outcome = no_show), veya
 * - İptal edilmemiş, seans bitmiş, 2 saat kuralı geçmiş (otomatik no-show)
 */
export function isSessionConsumed(row, now = Date.now()) {
  if (isSessionCancelled(row)) return false;
  const { startTs, endTs, checkedInAt, attendanceOutcome } = normalizeSessionRow(row);
  if (checkedInAt != null) return true;
  if (attendanceOutcome === 'no_show') return true;
  if (now > endTs && now >= startTs - TWO_HOURS_MS) return true;
  return false;
}

/** Aktif paket özeti: kalan hak = lesson_count − tüketilen */
export function computePackageSessionCounts(sessions, lessonCount, now = Date.now()) {
  const active = (sessions || []).filter((s) => !isSessionCancelled(s));
  const consumedSessions = active.filter((s) => isSessionConsumed(s, now)).length;
  const remainingSessions = Math.max(0, Number(lessonCount || 0) - consumedSessions);
  const scheduledFuture = active.filter((s) => {
    const { startTs } = normalizeSessionRow(s);
    return startTs > now && !isSessionConsumed(s, now);
  }).length;

  return {
    consumedSessions,
    remainingSessions,
    scheduledFuture,
    totalSessions: active.length,
  };
}

/** Kapı QR: randevu penceresindeki uygun seansı işaretle */
export async function checkInSessionForMember(db, memberId, now = Date.now(), method = 'qr') {
  const res = await db.query(
    `SELECT s.id, s.start_ts, s.end_ts, s.member_package_id
     FROM sessions s
     JOIN member_packages mp ON mp.id = s.member_package_id AND mp.status = 'active'
     WHERE s.member_id = $1
       AND s.deleted_at IS NULL
       AND s.checked_in_at IS NULL
       AND s.start_ts <= $2
       AND s.end_ts >= $3
     ORDER BY ABS(s.start_ts - $4) ASC
     LIMIT 1`,
    [memberId, now + CHECK_IN_EARLY_MS, now - CHECK_IN_LATE_MS, now]
  );

  if (res.rows.length === 0) {
    return { checkedIn: false, reason: 'no_session' };
  }

  const session = res.rows[0];
  await db.query(
    `UPDATE sessions SET checked_in_at = CURRENT_TIMESTAMP, check_in_method = $2,
     attendance_outcome = 'present', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [session.id, method]
  );

  return {
    checkedIn: true,
    sessionId: session.id,
    memberPackageId: session.member_package_id,
    startTs: Number(session.start_ts),
  };
}
