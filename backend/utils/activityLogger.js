/**
 * İşlem (audit) logları – kim, ne, ne zaman.
 * Tüm mutasyonlarda bu modülü kullanın; ileride personel girişi ile actor bilgisi otomatik dolar.
 */
import db from '../config/database.js';

/**
 * İşlem kaydı yazar.
 * @param {object} req - Express request (req.user, req.ip, req.get('user-agent'))
 * @param {object} options
 * @param {string} options.action - Örn: 'member.create', 'session.delete', 'auth.login'
 * @param {string} [options.entityType] - Örn: 'member', 'session', 'room'
 * @param {string|number} [options.entityId] - İlgili kayıt id
 * @param {object} [options.details] - Ek bilgi (JSON; hassas veri eklemeyin)
 * @param {string} [options.actorName] - Görüntüleme adı (yoksa user#id veya 'anonymous')
 * @param {number} [options.actorId] - Zorunlu actor id (örn. login sonrası giriş yapan kullanıcı)
 * @param {string} [options.actorType] - Zorunlu actor_type (options.actorId ile birlikte kullanılır)
 */
export async function log(req, options) {
  const { action, entityType = null, entityId = null, details = {}, actorName, actorId, actorType } = options;
  if (!action || typeof action !== 'string') return;

  let actor_type = 'anonymous';
  let actor_id = null;
  let actor_name = actorName ?? 'Anonim';

  if (actorId != null && (actorType === 'user' || actorType === 'system')) {
    actor_type = actorType;
    actor_id = Number(actorId) || null;
    actor_name = actorName ?? (actor_type === 'user' ? `Kullanıcı#${actor_id}` : 'Sistem');
  } else if (req && req.user) {
    actor_type = 'user';
    actor_id = req.user.userId ?? null;
    actor_name = actorName ?? (req.user.username ? String(req.user.username) : `Kullanıcı#${actor_id ?? '-'}`);
  }

  const ip_address = req && (req.ip || req.connection?.remoteAddress)
    ? String(req.ip || req.connection.remoteAddress).replace(/^::ffff:/, '') : null;
  const user_agent = req && typeof req.get === 'function' ? req.get('user-agent') || null : null;

  const entityIdStr = entityId != null ? String(entityId) : null;
  const detailsJson = typeof details === 'object' && details !== null ? details : {};

  try {
    await db.query(
      `INSERT INTO activity_logs (actor_type, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        actor_type,
        actor_id,
        actor_name?.substring(0, 255) || null,
        action.substring(0, 100),
        entityType?.substring(0, 50) || null,
        entityIdStr?.substring(0, 50) || null,
        JSON.stringify(detailsJson),
        ip_address?.substring(0, 45) || null,
        user_agent?.substring(0, 2048) || null
      ]
    );
  } catch (err) {
    // Tablo yoksa veya migration henüz çalışmadıysa sadece konsola yaz
    if (err.code === '42P01' || err.code === '42703') {
      console.warn('[activityLogger] Veritabanına yazılamadı (migration gerekebilir):', action, err.message);
    } else {
      console.error('[activityLogger] Log yazma hatası:', err.message);
    }
  }
}

export default { log };
