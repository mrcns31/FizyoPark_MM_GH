import db from '../config/database.js';
import { sendExpoPush } from './pushNotifications.js';
import { localTodayDateStr } from './memberPackageStatus.js';
import { getOrInitPackageNotifyGoLiveTs } from './appSettings.js';
import {
  autoCompletePackageIfExhausted,
  computePackageSessionCounts,
} from './packageSessionCounts.js';

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

/**
 * Bu tip bildirim bu pakete daha önce hiç gönderilmiş mi?
 * Paket bir kez bittiği için 'exhausted' cooldown ile değil, tek seferlik kontrol edilir.
 */
async function wasEverSent(memberPackageId, type) {
  try {
    const { rows } = await db.query(
      `SELECT 1 FROM package_notification_log
       WHERE member_package_id = $1 AND type = $2
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
 * @param {object} [opts]
 * @param {number} [opts.goLiveTs] - devreye alma anı (ms); bu andan önceki durumlar bildirim üretmez
 * @param {boolean} [opts.consumedSinceGoLive] - paketten devreye almadan sonra seans tüketildi mi
 * @returns {{ sessionLow: boolean, expiryWarning: boolean }}
 */
export async function checkAndSendPackageNotifications(mp, remainingSessions, opts = {}) {
  const { goLiveTs = -Infinity, consumedSinceGoLive = true } = opts;
  const todayStr = localTodayDateStr();
  const lessonCount = Number(mp.lesson_count || 0);
  const userId = mp.user_id;

  const result = { sessionLow: false, expiryWarning: false };
  if (!userId || lessonCount === 0) return result;

  // — SEANS BAZLI (25% eşiği) —
  // Kalan hak yalnızca seans tüketilince azalır: devreye almadan sonra hiç seans
  // tüketilmemişse üyenin durumu değişmemiştir, geriye dönük uyarı gönderilmez.
  const sessionThreshold = Math.ceil(lessonCount * 0.25);
  if (consumedSinceGoLive && remainingSessions > 0 && remainingSessions <= sessionThreshold) {
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

    // Paketin %25'lik son dilimine girdiği gün: bu gün devreye almadan önceyse
    // uyarı zaten geçmişte kalmış demektir, geriye dönük gönderilmez.
    const thresholdDays = totalDays != null ? Math.ceil(totalDays * 0.25) : null;
    const enteredThresholdTs =
      thresholdDays != null
        ? new Date(endStr + 'T00:00:00Z').getTime() - thresholdDays * 24 * 3600 * 1000
        : null;

    if (
      totalDays != null &&
      remaining != null &&
      remaining > 0 &&
      remaining <= thresholdDays &&
      enteredThresholdTs != null &&
      enteredThresholdTs > goLiveTs
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
 *
 * Devreye alma anından önceki durumlar bildirim üretmez: sistem ilk açıldığında
 * eşiğin altındaki tüm üyelere toplu uyarı gitmez.
 */
export async function runPackageNotifications(now = Date.now()) {
  const goLiveTs = await getOrInitPackageNotifyGoLiveTs(now);
  if (!Number.isFinite(goLiveTs)) {
    return { checked: 0, sessionLow: 0, expiryWarning: 0 };
  }

  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT mp.id, u.id AS user_id, mp.start_date, mp.end_date,
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
              ) AS consumed,
              EXISTS (
                SELECT 1
                FROM sessions s
                WHERE s.member_package_id = mp.id
                  AND s.deleted_at IS NULL
                  AND s.end_ts > $1
                  AND (
                    s.checked_in_at IS NOT NULL
                    OR s.attendance_outcome = 'no_show'
                    OR (s.end_ts < EXTRACT(EPOCH FROM NOW()) * 1000
                        AND s.end_ts >= s.start_ts - 2 * 3600 * 1000)
                  )
              ) AS consumed_since_go_live
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       JOIN members m ON m.id = mp.member_id
       JOIN users u ON u.id = m.user_id
       WHERE mp.status = 'active'
         AND mp.end_date >= CURRENT_DATE`,
      [goLiveTs]
    ));
  } catch (err) {
    console.error('[packageNotifications] Sorgu hatası:', err.message);
    return { checked: 0, sessionLow: 0, expiryWarning: 0 };
  }

  let sessionLowCount = 0;
  let expiryWarningCount = 0;

  for (const mp of rows) {
    const lessonCount = Number(mp.pkg_lesson_count || 0);
    const consumed = Number(mp.consumed || 0);
    const remaining = Math.max(0, lessonCount - consumed);

    const r = await checkAndSendPackageNotifications(
      { ...mp, lesson_count: lessonCount },
      remaining,
      { goLiveTs, consumedSinceGoLive: mp.consumed_since_go_live === true }
    );
    if (r.sessionLow) sessionLowCount++;
    if (r.expiryWarning) expiryWarningCount++;
  }

  console.log(
    `[packageNotifications] ${rows.length} paket kontrol edildi → seans_low: ${sessionLowCount}, expiry: ${expiryWarningCount}`
  );
  return { checked: rows.length, sessionLow: sessionLowCount, expiryWarning: expiryWarningCount };
}

// ── Paket bitti → yeni paket talebi daveti ──────────────────────────────
// Üye paketindeki son seansını tamamladığında tetiklenir. runPackageNotifications'ın
// %25 eşikli 'session_low' uyarısından bağımsızdır; ikisi ayrı tip olduğu için
// üye önce "2 seans kaldı", sonra "paketiniz bitti" mesajını alır.

/** Bu saatler dışında gönderilmez (Istanbul) — akşamki seanslar ertesi sabah 09:00'da yakalanır */
const EXHAUSTED_START_HOUR = 9;
const EXHAUSTED_END_HOUR = 22;

/** Seans bitiminden en az bu kadar sonra gönderilir — üye daha tesisten çıkmadan bildirim gitmesin */
const EXHAUSTED_DELAY_MS = 60 * 60 * 1000;

/** Geriye dönük tarama sınırı — cron bir süre çalışmazsa kaçan seanslar yakalansın */
const EXHAUSTED_LOOKBACK_MS = 48 * 60 * 60 * 1000;

/** Tek turda incelenecek en fazla paket */
const EXHAUSTED_BATCH = 100;

const EXHAUSTED_MESSAGE =
  '🎉 Paketinizdeki tüm seanslarınızı tamamladınız. Yeni paket talebinizi uygulamadan iletebilirsiniz.';

/**
 * Son 48 saat içinde seansı biten paketleri tarar; kalan hakkı 0'a inenlere
 * yeni paket talebi daveti gönderir. Saatlik cron'dan çağrılır.
 *
 * Yalnızca devreye alma anından SONRA biten seanslar tetikler: sistem ilk
 * açıldığında paketi çoktan bitmiş üyelere geriye dönük bildirim gitmez.
 */
export async function runPackageExhaustedPrompts(now = Date.now()) {
  const istanbulHour = new Date(now + 3 * 3600 * 1000).getUTCHours();
  if (istanbulHour < EXHAUSTED_START_HOUR || istanbulHour >= EXHAUSTED_END_HOUR) {
    return { sent: 0, reason: 'quiet_hours' };
  }

  const goLiveTs = await getOrInitPackageNotifyGoLiveTs(now);
  if (!Number.isFinite(goLiveTs)) return { sent: 0, reason: 'not_live' };

  let candidates;
  try {
    ({ rows: candidates } = await db.query(
      `SELECT DISTINCT ON (mp.id)
              mp.id AS member_package_id,
              u.id  AS user_id,
              p.lesson_count AS lesson_count
       FROM sessions s
       JOIN member_packages mp ON mp.id = s.member_package_id
       JOIN packages p  ON p.id = mp.package_id
       JOIN members m   ON m.id = s.member_id
       JOIN users u     ON u.id = m.user_id
       WHERE s.deleted_at IS NULL
         AND m.deleted_at IS NULL
         AND mp.status <> 'cancelled'
         AND s.end_ts <= $1
         AND s.end_ts >= $2
         AND s.end_ts > $3
       ORDER BY mp.id, s.end_ts DESC
       LIMIT ${EXHAUSTED_BATCH}`,
      [now - EXHAUSTED_DELAY_MS, now - EXHAUSTED_LOOKBACK_MS, goLiveTs]
    ));
  } catch (err) {
    console.error('[packageNotifications] exhausted sorgu hatası:', err.message);
    return { sent: 0, reason: 'query_error' };
  }

  let sent = 0;
  for (const c of candidates) {
    try {
      if (await wasEverSent(c.member_package_id, 'exhausted')) continue;

      const { rows: sessions } = await db.query(
        `SELECT start_ts, end_ts, deleted_at, checked_in_at, attendance_outcome
         FROM sessions WHERE member_package_id = $1`,
        [c.member_package_id]
      );
      const { remainingSessions } = computePackageSessionCounts(
        sessions,
        c.lesson_count,
        now
      );
      if (remainingSessions > 0) continue;

      // Paketi 'completed' yap: aktif paketi olan üye yeni paket talebi gönderemiyor
      // (member-portal /package-request). Günlük 09:00 taramasını beklemeden kapat.
      await autoCompletePackageIfExhausted(db, c.member_package_id);

      const ok = await sendExpoPush(db, c.user_id, 'FizyoPark', EXHAUSTED_MESSAGE);
      if (ok) {
        await logNotification(c.member_package_id, 'exhausted');
        sent++;
      }
    } catch (err) {
      console.error(
        `[packageNotifications] exhausted paket ${c.member_package_id}:`,
        err.message
      );
    }
  }

  if (sent > 0) console.log(`[packageNotifications] exhausted: ${sent} davet gönderildi`);
  return { sent };
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
