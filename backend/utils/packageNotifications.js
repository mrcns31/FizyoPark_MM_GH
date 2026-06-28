import db from '../config/database.js';
import { sendExpoPush } from './pushNotifications.js';
import { localTodayDateStr } from './memberPackageStatus.js';
import { autoCompletePackageIfExhausted } from './packageSessionCounts.js';

const COOLDOWN_DAYS = 7;

/** Paket kullanım süresi: başlangıç → bitiş arası gün sayısı */
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr + 'T00:00:00Z').getTime();
  const end = new Date(endStr + 'T00:00:00Z').getTime();
  return Math.round((end - start) / (24 * 3600 * 1000));
}

/** Bugünden bitiş tarihine kalan gün */
function daysUntilEnd(endStr, todayStr) {
  if (!endStr) return null;
  const end = new Date(endStr + 'T00:00:00Z').getTime();
  const today = new Date(todayStr + 'T00:00:00Z').getTime();
  return Math.round((end - today) / (24 * 3600 * 1000));
}

/**
 * Son COOLDOWN_DAYS gün içinde bu tip bildirim gönderilmiş mi?
 * Tablo yoksa (42P01) false döner — ilk migrasyon öncesi safe.
 */
async function wasRecentlySent(memberPackageId, type) {
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM package_notification_log
       WHERE member_package_id = $1
         AND type = $2
         AND sent_at > NOW() - INTERVAL '${COOLDOWN_DAYS} days'
       LIMIT 1`,
      [memberPackageId, type]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.code === '42P01') return false;
    throw err;
  }
}

async function logNotification(memberPackageId, type) {
  try {
    await db.query(
      `INSERT INTO package_notification_log (member_package_id, type) VALUES ($1, $2)`,
      [memberPackageId, type]
    );
  } catch (err) {
    if (err.code === '42P01') return;
    throw err;
  }
}

/**
 * Tek bir aktif paket satırı için seans ve süre bazlı bildirim kontrolü.
 *
 * @param {object} mp - member_packages satırı (id, user_id, lesson_count, start_date, end_date, status)
 * @param {number} remainingSessions - hesaplanmış kalan seans hakkı
 * @returns {{ sessionLow: boolean, expiryWarning: boolean }}
 */
export async function checkAndSendPackageNotifications(mp, remainingSessions) {
  const todayStr = localTodayDateStr();
  const lessonCount = Number(mp.lesson_count || 0);
  const userId = mp.user_id;

  const result = { sessionLow: false, expiryWarning: false };
  if (!userId || lessonCount === 0) return result;

  // — SEANS BAZLI (25% eşiği) —
  const sessionThreshold = Math.ceil(lessonCount * 0.25);
  if (remainingSessions > 0 && remainingSessions <= sessionThreshold) {
    const already = await wasRecentlySent(mp.id, 'session_low');
    if (!already) {
      const ok = await sendExpoPush(
        db,
        userId,
        'FizyoPark',
        `📋 Paketinizden ${remainingSessions} seans hakkınız kalmıştır.`
      );
      if (ok) {
        await logNotification(mp.id, 'session_low');
        result.sessionLow = true;
      }
    }
  }

  // — SÜRE BAZLI (25% eşiği) —
  // Seanslar zaten %25 altına düşmüşse süre bildirimi gönderme
  // (üyeye iki ayrı uyarı göndermek yerine seans bildirimini öncelik ver)
  if (remainingSessions > sessionThreshold) {
    const startStr = typeof mp.start_date === 'string'
      ? mp.start_date.slice(0, 10)
      : new Date(mp.start_date).toISOString().slice(0, 10);
    const endStr = typeof mp.end_date === 'string'
      ? mp.end_date.slice(0, 10)
      : new Date(mp.end_date).toISOString().slice(0, 10);

    const totalDays = daysBetween(startStr, endStr);
    const remaining = daysUntilEnd(endStr, todayStr);

    if (
      totalDays != null &&
      remaining != null &&
      remaining > 0 &&
      remaining <= Math.ceil(totalDays * 0.25)
    ) {
      const already = await wasRecentlySent(mp.id, 'expiry_warning');
      if (!already) {
        const ok = await sendExpoPush(
          db,
          userId,
          'FizyoPark',
          `⏳ Paketinizin kullanım süresi ${remaining} gün içinde sona erecek. Kalan seans hakkınız: ${remainingSessions}.`
        );
        if (ok) {
          await logNotification(mp.id, 'expiry_warning');
          result.expiryWarning = true;
        }
      }
    }
  }

  return result;
}

/**
 * Tüm aktif paketleri tarayarak bildirim gerekenlere push gönderir.
 * Günlük cron job'dan çağrılır.
 */
export async function runPackageNotifications() {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT mp.id, mp.user_id, mp.lesson_count, mp.start_date, mp.end_date,
              mp.status,
              p.lesson_count AS pkg_lesson_count,
              (
                SELECT COUNT(*)
                FROM sessions s
                WHERE s.member_package_id = mp.id
                  AND s.deleted_at IS NULL
                  AND (
                    s.checked_in_at IS NOT NULL
                    OR s.attendance_outcome = 'no_show'
                    OR (s.end_ts < EXTRACT(EPOCH FROM NOW()) * 1000
                        AND s.end_ts >= s.start_ts - 2 * 3600 * 1000)
                  )
              ) AS consumed
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       JOIN members m ON m.id = mp.member_id
       JOIN users u ON u.id = m.user_id
       WHERE mp.status = 'active'
         AND mp.end_date >= CURRENT_DATE`,
    ));
  } catch (err) {
    console.error('[packageNotifications] Sorgu hatası:', err.message);
    return { checked: 0, sessionLow: 0, expiryWarning: 0 };
  }

  let sessionLowCount = 0;
  let expiryWarningCount = 0;

  for (const mp of rows) {
    const lessonCount = Number(mp.lesson_count || mp.pkg_lesson_count || 0);
    const consumed = Number(mp.consumed || 0);
    const remaining = Math.max(0, lessonCount - consumed);

    const r = await checkAndSendPackageNotifications({ ...mp, lesson_count: lessonCount }, remaining);
    if (r.sessionLow) sessionLowCount++;
    if (r.expiryWarning) expiryWarningCount++;
  }

  console.log(
    `[packageNotifications] ${rows.length} paket kontrol edildi → seans_low: ${sessionLowCount}, expiry: ${expiryWarningCount}`
  );
  return { checked: rows.length, sessionLow: sessionLowCount, expiryWarning: expiryWarningCount };
}

/**
 * Bitiş tarihi geçmiş aktif paketleri 'completed' olarak işaretler.
 * server.js setInterval'den db parametresi olmadan çağrılabilmesi için wrapper.
 */
export async function runAutoCompletePackages() {
  const completed = await autoCompletePackageIfExhausted(db);
  if (completed.length > 0) {
    console.log(`[dailyCron] ${completed.length} paket 'completed' olarak güncellendi:`, completed);
  }
  return completed;
}
