import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

// Sadece admin ve manager paket tanımlayabilir
const checkAdminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

// Paket listesi
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM packages ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Packages list error:', error);
    res.status(500).json({ error: 'Paket listesi alınırken hata oluştu' });
  }
});

// Yeni paket ekle
router.post('/', checkAdminOrManager, [
  body('name').trim().notEmpty().withMessage('Paket adı gerekli'),
  body('lesson_count').isInt({ min: 1 }).withMessage('Ders adet en az 1 olmalı'),
  body('month_overrun').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Ay aşım süresi 0 veya pozitif olmalı'),
  body('weekly_lesson_count').optional({ nullable: true }).isInt({ min: 0 }),
  body('package_type').optional({ nullable: true }).isIn(['fixed', 'flexible']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      lesson_count = 1,
      month_overrun = 0,
      weekly_lesson_count,
      package_type = 'fixed',
    } = req.body;

    const result = await db.query(
      `INSERT INTO packages (name, lesson_count, month_overrun, weekly_lesson_count, package_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), lesson_count, month_overrun ?? 0, weekly_lesson_count ?? null, package_type]
    );
    const created = result.rows[0];
    await activityLog(req, { action: 'package.create', entityType: 'package', entityId: created.id, details: { name: created.name, lesson_count: created.lesson_count } }).catch(() => {});

    res.status(201).json(created);
  } catch (error) {
    console.error('Package create error:', error);
    res.status(500).json({ error: 'Paket eklenirken hata oluştu' });
  }
});

// Paket güncelle
router.put('/:id', checkAdminOrManager, [
  body('name').optional({ nullable: true }).trim().notEmpty(),
  body('lesson_count').optional({ nullable: true }).isInt({ min: 1 }),
  body('month_overrun').optional({ nullable: true }).isInt({ min: 0 }),
  body('weekly_lesson_count').optional({ nullable: true }).isInt({ min: 0 }),
  body('package_type').optional({ nullable: true }).isIn(['fixed', 'flexible']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, lesson_count, month_overrun, weekly_lesson_count, package_type } = req.body;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (lesson_count !== undefined) {
      updateFields.push(`lesson_count = $${paramIndex++}`);
      values.push(lesson_count);
    }
    if (month_overrun !== undefined) {
      updateFields.push(`month_overrun = $${paramIndex++}`);
      values.push(month_overrun);
    }
    if (weekly_lesson_count !== undefined) {
      updateFields.push(`weekly_lesson_count = $${paramIndex++}`);
      values.push(weekly_lesson_count);
    }
    if (package_type !== undefined) {
      updateFields.push(`package_type = $${paramIndex++}`);
      values.push(package_type);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE packages SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paket bulunamadı' });
    }
    const updated = result.rows[0];
    await activityLog(req, { action: 'package.update', entityType: 'package', entityId: id, details: { name: updated.name } }).catch(() => {});
    res.json(updated);
  } catch (error) {
    console.error('Package update error:', error);
    res.status(500).json({ error: 'Paket güncellenirken hata oluştu' });
  }
});

// Paket sil
router.delete('/:id', checkAdminOrManager, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM packages WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paket bulunamadı' });
    }
    const deleted = result.rows[0];
    await activityLog(req, { action: 'package.delete', entityType: 'package', entityId: id, details: { name: deleted.name } }).catch(() => {});
    res.json({ message: 'Paket silindi' });
  } catch (error) {
    console.error('Package delete error:', error);
    res.status(500).json({ error: 'Paket silinirken hata oluştu' });
  }
});

// Excel'e aktar (CSV - Excel uyumlu, BOM ile)
router.get('/export/csv', checkAdminOrManager, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT name, lesson_count, month_overrun, weekly_lesson_count, package_type FROM packages ORDER BY name'
    );

    const headers = ['Paket Adı', 'Ders Adet', 'Ay Aşım Süresi', 'Haftalık Ders Sayısı', 'Paket Tipi'];
    const typeLabel = (t) => (t === 'flexible' ? 'Esnek' : 'Sabit');
    const rows = result.rows.map((r) => [
      r.name,
      r.lesson_count,
      r.month_overrun,
      r.weekly_lesson_count ?? '',
      typeLabel(r.package_type),
    ]);

    const csvContent = [
      '\uFEFF', // UTF-8 BOM (Excel için)
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="paketler.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Packages export error:', error);
    res.status(500).json({ error: 'Dışa aktarım sırasında hata oluştu' });
  }
});

export default router;
