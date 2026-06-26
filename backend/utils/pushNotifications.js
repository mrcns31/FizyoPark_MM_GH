/** Expo Push Notification gönderme — tüm servisler bu modülü kullanır. */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Tek bir kullanıcıya push gönderir.
 * @returns {Promise<boolean>} token bulunduysa true
 */
export async function sendExpoPush(db, userId, title, body) {
  try {
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    if (!rows.length) return false;
    const messages = rows.map((r) => ({
      to: r.token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'fizyopark',
    }));
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Birden fazla user_id'ye toplu push gönderir.
 * @returns {Promise<{sent: number, noToken: number}>}
 */
export async function sendExpoPushBulk(db, userIds, title, body) {
  if (!userIds.length) return { sent: 0, noToken: 0 };

  const { rows } = await db.query(
    'SELECT user_id, token FROM push_tokens WHERE user_id = ANY($1::int[])',
    [userIds],
  );

  const tokensByUser = new Map();
  for (const r of rows) {
    if (!tokensByUser.has(r.user_id)) tokensByUser.set(r.user_id, []);
    tokensByUser.get(r.user_id).push(r.token);
  }

  const messages = [];
  for (const [, tokens] of tokensByUser) {
    for (const token of tokens) {
      messages.push({ to: token, title, body, sound: 'default', priority: 'high', channelId: 'fizyopark' });
    }
  }

  if (messages.length) {
    // Expo max 100 mesaj/istek
    for (let i = 0; i < messages.length; i += 100) {
      try {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
      } catch {
        // push hatası gönderimi durdurmaz
      }
    }
  }

  const sent = tokensByUser.size;
  const noToken = userIds.length - sent;
  return { sent, noToken };
}

export default { sendExpoPush, sendExpoPushBulk };
