import db from '../config/database.js';
import { sendExpoPush } from './pushNotifications.js';

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
    if (ok) sent++;
    await db.query(
      `INSERT INTO session_reminders (session_id, reminder_type) VALUES ($1, '24h') ON CONFLICT DO NOTHING`,
      [r.id]
    );
  }

  console.log(`[sessionReminders] 24h: ${sent} bildirim gönderildi`);
  return { sent };
}

// Sabah 7:00 hatırlatması: o günkü tüm seanslar için
export async function runMorningReminders(now = Date.now()) {
  // Istanbul UTC+3 — bugünün başı ve sonu
  const istanbulNow = new Date(now + 3 * 3600 * 1000);
  const dayStartUtc =
    Date.UTC(istanbulNow.getUTCFullYear(), istanbulNow.getUTCMonth(), istanbulNow.getUTCDate()) -
    3 * 3600 * 1000;
  const dayEndUtc = dayStartUtc + 24 * 3600 * 1000;

  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT s.id, s.start_ts, u.id AS user_id
       FROM sessions s
       JOIN members m ON m.id = s.member_id
       JOIN users u ON u.id = m.user_id
       LEFT JOIN session_reminders sr ON sr.session_id = s.id AND sr.reminder_type = 'morning'
       WHERE s.deleted_at IS NULL
         AND s.member_id IS NOT NULL
         AND s.start_ts >= $1 AND s.start_ts < $2
         AND sr.id IS NULL`,
      [dayStartUtc, dayEndUtc]
    ));
  } catch (err) {
    if (err.code === '42P01') return { sent: 0, reason: 'table_missing' };
    throw err;
  }

  if (!rows.length) return { sent: 0 };

  let sent = 0;
  for (const r of rows) {
    const timeStr = formatTime(r.start_ts);
    const ok = await sendExpoPush(db, r.user_id, 'FizyoPark', `🗓️ Bugün ${timeStr}'da seansınız var. Görüşmek üzere 👋`);
    if (ok) sent++;
    await db.query(
      `INSERT INTO session_reminders (session_id, reminder_type) VALUES ($1, 'morning') ON CONFLICT DO NOTHING`,
      [r.id]
    );
  }

  console.log(`[sessionReminders] morning: ${sent} bildirim gönderildi`);
  return { sent };
}
