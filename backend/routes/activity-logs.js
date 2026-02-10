/**
 * İşlem logları API – kim, ne, ne zaman.
 * Sadece admin ve manager listeleyebilir.
 */
import express from 'express';
import { query, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();
router.use(verifyToken);

const checkAdminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

// Log listesi (sayfalı, filtreli)
router.get('/', checkAdminOrManager, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('action').optional().trim().isLength({ max: 100 }),
  query('entityType').optional().trim().isLength({ max: 50 }),
  query('actorId').optional().isInt().toInt(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let pi = 1;

    if (req.query.action) {
      conditions.push(`action = $${pi++}`);
      params.push(req.query.action.trim());
    }
    if (req.query.entityType) {
      conditions.push(`entity_type = $${pi++}`);
      params.push(req.query.entityType.trim());
    }
    if (req.query.actorId != null) {
      conditions.push(`actor_id = $${pi++}`);
      params.push(req.query.actorId);
    }
    if (req.query.from) {
      conditions.push(`created_at >= $${pi++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push(`created_at <= $${pi++}`);
      params.push(req.query.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM activity_logs ${where}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    params.push(limit, offset);
    const result = await db.query(
      `SELECT id, actor_type, actor_id, actor_name, action, entity_type, entity_id, details, ip_address, created_at
       FROM activity_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      params
    );

    res.json({
      items: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'Log tablosu henüz oluşturulmamış. migration_activity_logs.sql çalıştırın.' });
    }
    console.error('Activity logs list error:', err);
    res.status(500).json({ error: 'Log listesi alınırken hata oluştu' });
  }
});

export default router;
