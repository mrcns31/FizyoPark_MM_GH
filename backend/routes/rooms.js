import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

// Oda listesi
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM rooms ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Rooms list error:', error);
    res.status(500).json({ error: 'Oda listesi alınırken hata oluştu' });
  }
});

// Yeni oda ekle
router.post('/', [
  body('name').trim().notEmpty(),
  body('devices').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, devices } = req.body;

    // Aynı isimde oda var mı kontrol et
    const existing = await db.query('SELECT id FROM rooms WHERE LOWER(name) = LOWER($1)', [name]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bu isimde bir oda zaten var' });
    }

    const result = await db.query(
      `INSERT INTO rooms (name, devices)
       VALUES ($1, $2)
       RETURNING *`,
      [name, devices]
    );
    const created = result.rows[0];
    await activityLog(req, { action: 'room.create', entityType: 'room', entityId: created.id, details: { name: created.name, devices: created.devices } }).catch(() => {});

    res.status(201).json(created);
  } catch (error) {
    console.error('Room create error:', error);
    res.status(500).json({ error: 'Oda eklenirken hata oluştu' });
  }
});

// Oda güncelle
router.put('/:id', [
  body('name').optional().trim().notEmpty(),
  body('devices').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, devices } = req.body;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      // Aynı isimde başka oda var mı kontrol et
      const existing = await db.query(
        'SELECT id FROM rooms WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Bu isimde bir oda zaten var' });
      }

      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (devices !== undefined) {
      updateFields.push(`devices = $${paramIndex++}`);
      values.push(devices);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE rooms SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oda bulunamadı' });
    }
    const updated = result.rows[0];
    await activityLog(req, { action: 'room.update', entityType: 'room', entityId: id, details: { name: updated.name, devices: updated.devices } }).catch(() => {});
    res.json(updated);
  } catch (error) {
    console.error('Room update error:', error);
    res.status(500).json({ error: 'Oda güncellenirken hata oluştu' });
  }
});

// Oda sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Oda kullanılıyor mu kontrol et (silinmemiş seanslar)
    const sessions = await db.query('SELECT id FROM sessions WHERE room_id = $1 AND (deleted_at IS NULL) LIMIT 1', [id]);
    if (sessions.rows.length > 0) {
      return res.status(409).json({ error: 'Bu oda kullanılıyor, önce seansları silin' });
    }

    const result = await db.query('DELETE FROM rooms WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oda bulunamadı' });
    }
    const deleted = result.rows[0];
    await activityLog(req, { action: 'room.delete', entityType: 'room', entityId: id, details: { name: deleted.name } }).catch(() => {});
    res.json({ message: 'Oda silindi' });
  } catch (error) {
    console.error('Room delete error:', error);
    res.status(500).json({ error: 'Oda silinirken hata oluştu' });
  }
});

export default router;
