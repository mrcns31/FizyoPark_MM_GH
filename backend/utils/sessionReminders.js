import db from '../config/database.js';
import { sendExpoPush } from './pushNotifications.js';
import { getRatingsGoLiveTs } from './appSettings.js';
import { RATING_WINDOW_MS, ratableSessionSql } from './sessionRatings.js';

function formatTime(startTs) {
  return new Date(Number(startTs)).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
}

// 24 saat öncesi hatırlatma: her saat çalışır, 23-25h penceresindeki seansları yakalar
export async function run24hReminders(now = Date.now()) {
  const windowStart = now + 23 * 3600 * 1000;
  const windowEnd = now + 25 * 3600 * 1000;

  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT s.id, s.start_ts, u.id AS user_id
       FROM sessions s
       JOIN members m ON m.id = s.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN session_reminders sr ON sr.session_id = s.id AND sr.reminder_type = '24h'
       WHERE s.deleted_at IS NULL
         AND m.deleted_at IS NULL
         AND s.member_id IS NOT NULL
         AND s.start_ts >= $1 AND s.start_ts <= $2
         AND sr.id IS NULL`,
      [windowStart, windowEnd]
    ));
  } catch (err) {
    if (err.code === '42P01') return { sent: 0, reason: 'table_missing' };
    throw err;
  }

  if (!rows.length) return { sent: 0 };

  let sent = 0;
  for (const r of rows) {
    const timeStr = formatTime(r.start_ts);
    const ok = await sendExpoPush(db, r.user_id, 'FizyoPark', `🗓️ Yarın ${timeStr}'da seansınız var. Görüşmek üzere 👋`);
    if (ok) {
      sent++;
      await db.query(
        `INSERT INTO session_reminders (session_id, reminder_type) VALUES ($1, '24h') ON CONFLICT DO NOTHING`,
        [r.id]
      );
    }
  }

  console.log(`[sessionReminders] 24h: ${sent} bildirim gönderildi`);
  return { sent };
}

/** Puanlama daveti bu saatler dışında gönderilmez (Istanbul) */
const RATING_PROMPT_START_HOUR = 9;
const RATING_PROMPT_END_HOUR = 22;

/** Seans bitiminden en az bu kadar sonra sorulur — üye daha tesisten çıkmadan bildirim gitmesin */
const RATING_PROMPT_DELAY_MS = 60 * 60 * 1000;

/** Tek turda gönderilecek en fazla davet — ilk çalışmada birikmiş kayıt varsa patlamasın */
const RATING_PROMPT_BATCH = 200;

/**
 * Seans puanlama daveti: bitmiş, puanlanmamış ve daha önce davet gönderilmemiş seanslar.
 * Sessiz saatlerde hiç gönderilmez; akşamki seanslar ertesi sabah 09:00'da yakalanır.
 */
export async function runRatingPrompts(now = Date.now()) {
  const istanbulHour = new Date(now + 3 * 3600 * 1000).getUTCHours();
  if (istanbulHour < RATING_PROMPT_START_HOUR || istanbulHour >= RATING_PROMPT_END_HOUR) {
    return { sent: 0, reason: 'quiet_hours' };
  }

  const goLiveTs = await getRatingsGoLiveTs();
  if (!Number.isFinite(goLiveTs)) return { sent: 0, reason: 'not_live' };

  const cutoff = now - RATING_PROMPT_DELAY_MS;

  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT s.id, u.id AS user_id
       FROM sessions s
       JOIN members m ON m.id = s.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN session_reminders srem
              ON srem.session_id = s.id AND srem.reminder_type = 'rating'
       LEFT JOIN session_ratings srat ON srat.session_id = s.id
       WHERE m.deleted_at IS NULL
         AND ${ratableSessionSql(1, 2)}
         AND s.end_ts <= $3
         AND s.end_ts >= $4
         AND srem.id IS NULL
         AND srat.id IS NULL
       ORDER BY s.end_ts DESC
       LIMIT ${RATING_PROMPT_BATCH}`,
      [now, goLiveTs, cutoff, now - RATING_WINDOW_MS]
    ));
  } catch (err) {
    if (err.code === '42P01') return { sent: 0, reason: 'table_missing' };
    throw err;
  }

  if (!rows.length) return { sent: 0 };

  let sent = 0;
  for (const r of rows) {
    const ok = await sendExpoPush(
      db,
      r.user_id,
      'FizyoPark',
      '⭐ Son seansınızı puanlar mısınız? Görüşleriniz bizim için değerli.'
    );
    if (ok) {
      sent++;
      await db.query(
        `INSERT INTO session_reminders (session_id, reminder_type) VALUES ($1, 'rating') ON CONFLICT DO NOTHING`,
        [r.id]
      );
    }
  }

  if (sent > 0) console.log(`[sessionReminders] rating: ${sent} davet gönderildi`);
  return { sent };
}

