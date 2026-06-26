/**
 * Admin toplu push bildirimi — seçili üyelere mesaj gönder, geçmişi görüntüle.
 * Yalnızca admin ve manager kullanabilir.
 */
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { sendExpoPushBulk } from '../utils/pushNotifications.js';

const router = express.Router();
router.use(verifyToken);

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

// ── POST /admin/broadcast ─────────────────────────────────────────────────
// Seçili üyelere push gönder ve broadcasts tablosuna kaydet
router.post(
  '/',
  requireAdmin,
  [
    body('memberIds').isArray({ min: 1 }).withMessage('En az bir üye seçilmeli'),
    body('memberIds.*').isInt({ min: 1 }),
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Başlık gerekli'),
    body('body').trim().isLength({ min: 1, max: 1000 }).withMessage('Mesaj gerekli'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { memberIds, title, body: msgBody } = req.body;
    const uniqueIds = [...new Set(memberIds.map(Number))];

    try {
      // Üyelerin user_id ve adını çek
      const membersRes = await db.query(
        `SELECT m.id AS member_id, m.name AS member_name, u.id AS user_id
         FROM members m
         LEFT JOIN users u ON u.id = m.user_id
         WHERE m.id = ANY($1::int[])`,
        [uniqueIds],
      );
      const members = membersRes.rows;

      // Üyeleri user_id'si olanlar ve olmayanlar
      const withUser = members.filter((m) => m.user_id != null);
      const userIds = withUser.map((m) => m.user_id);

      // Push gönder
      const { sent, noToken } = await sendExpoPushBulk(db, userIds, title, msgBody);

      // Token'ı olan user_id seti (hangi üyeye ulaştı)
      const { rows: tokenRows } = await db.query(
        'SELECT DISTINCT user_id FROM push_tokens WHERE user_id = ANY($1::int[])',
        [userIds],
      );
      const usersWithToken = new Set(tokenRows.map((r) => r.user_id));

      // Gönderici adı
      const actorRes = await db.query(
        `SELECT COALESCE(display_name, username, 'Admin') AS name FROM users WHERE id = $1`,
        [req.user.userId],
      );
      const sentByName = actorRes.rows[0]?.name ?? 'Admin';

      // broadcasts kaydı
      const totalSelected = uniqueIds.length;
      const totalNoToken = totalSelected - sent;

      const broadcastRes = await db.query(
        `INSERT INTO broadcasts (sent_by_user_id, sent_by_name, title, body, total_selected, total_sent, total_no_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.user.userId, sentByName, title, msgBody, totalSelected, sent, totalNoToken],
      );
      const broadcastId = broadcastRes.rows[0].id;

      // broadcast_recipients kayıtları (unnest ile parameterized)
      if (members.length) {
        const bIds      = members.map(() => broadcastId);
        const mIds      = members.map((m) => m.member_id);
        const mNames    = members.map((m) => m.member_name ?? null);
        const hasTokens = members.map((m) => m.user_id != null && usersWithToken.has(m.user_id));
        await db.query(
          `INSERT INTO broadcast_recipients (broadcast_id, member_id, member_name, has_token)
           SELECT * FROM unnest($1::int[], $2::int[], $3::text[], $4::bool[])`,
          [bIds, mIds, mNames, hasTokens],
        );
      }

      res.json({
        broadcastId,
        totalSelected,
        sent,
        noToken: totalNoToken,
        message: `${sent} üyeye bildirim gönderildi${totalNoToken > 0 ? `, ${totalNoToken} üyenin uygulaması yok` : ''}.`,
      });
    } catch (err) {
      if (err.code === '42P01') {
        return res.status(503).json({ error: 'Broadcasts tablosu oluşturulmamış. migration_broadcasts.sql çalıştırın.' });
      }
      console.error('Broadcast error:', err);
      res.status(500).json({ error: 'Bildirim gönderilemedi' });
    }
  },
);

// ── GET /admin/broadcast ──────────────────────────────────────────────────
// Gönderim geçmişi (sayfalı)
router.get(
  '/',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const page = Math.max(1, req.query.page || 1);
    const limit = Math.min(100, req.query.limit || 20);
    const offset = (page - 1) * limit;

    try {
      const countRes = await db.query('SELECT COUNT(*)::int AS total FROM broadcasts');
      const total = countRes.rows[0]?.total ?? 0;

      const listRes = await db.query(
        `SELECT id, sent_by_name, title, body, total_selected, total_sent, total_no_token, created_at
         FROM broadcasts
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        items: listRes.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      if (err.code === '42P01') {
        return res.status(503).json({ error: 'Broadcasts tablosu oluşturulmamış. migration_broadcasts.sql çalıştırın.' });
      }
      console.error('Broadcast list error:', err);
      res.status(500).json({ error: 'Geçmiş alınamadı' });
    }
  },
);

// ── GET /admin/broadcast/:id/recipients ──────────────────────────────────
// Belirli bir gönderimin alıcı listesi
router.get('/:id/recipients', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Geçersiz id' });
  try {
    const { rows } = await db.query(
      `SELECT member_id, member_name, has_token
       FROM broadcast_recipients WHERE broadcast_id = $1 ORDER BY member_name`,
      [id],
    );
    res.json({ recipients: rows });
  } catch (err) {
    console.error('Broadcast recipients error:', err);
    res.status(500).json({ error: 'Alıcı listesi alınamadı' });
  }
});

export default router;
