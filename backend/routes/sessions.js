import express from 'express';
import { body, validationResult, query } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();

// Tüm route'lar için authentication gerekli
router.use(verifyToken);

// Seansları listele (filtreleme ile)
router.get('/', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('staffId').optional().isInt(),
  query('roomId').optional().isInt()
], async (req, res) => {
  try {
    const { startDate, endDate, staffId, roomId } = req.query;
    
    let query = `
      SELECT s.*, 
             st.first_name || ' ' || st.last_name as staff_name,
             m.name as member_name,
             r.name as room_name
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Filtreleme
    if (startDate) {
      const startTs = new Date(startDate).getTime();
      query += ` AND s.start_ts >= $${paramIndex++}`;
      params.push(startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate).getTime();
      query += ` AND s.end_ts <= $${paramIndex++}`;
      params.push(endTs);
    }
    if (staffId) {
      query += ` AND s.staff_id = $${paramIndex++}`;
      params.push(staffId);
    }
    if (roomId) {
      query += ` AND s.room_id = $${paramIndex++}`;
      params.push(roomId);
    }

    // Staff rolü sadece kendi seanslarını görebilir
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0) {
        query += ` AND s.staff_id = $${paramIndex++}`;
        params.push(staffResult.rows[0].id);
      }
    }

    query += ' ORDER BY s.start_ts ASC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: 'Seanslar listelenirken bir hata oluştu' });
  }
});

// Yeni seans oluştur
router.post('/', [
  body('staffId').isInt().withMessage('Personel ID gerekli'),
  body('memberId').isInt().withMessage('Üye ID gerekli'),
  body('roomId').optional().isInt(),
  body('startTs').isInt().withMessage('Başlangıç zamanı gerekli'),
  body('endTs').isInt().withMessage('Bitiş zamanı gerekli'),
  body('note').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { staffId, memberId, roomId, startTs, endTs, note } = req.body;

    // Çakışma kontrolü (basit)
    const conflictCheck = await db.query(
      `SELECT id FROM sessions 
       WHERE staff_id = $1 
       AND ((start_ts <= $2 AND end_ts > $2) OR (start_ts < $3 AND end_ts >= $3))
       AND id != COALESCE($4, -1)`,
      [staffId, startTs, endTs, null]
    );

    if (conflictCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Personel bu saatte başka bir seansı var' });
    }

    // Oda kapasitesi kontrolü
    if (roomId) {
      const roomCapacity = await db.query(
        `SELECT r.devices, COUNT(s.id) as current_sessions
         FROM rooms r
         LEFT JOIN sessions s ON s.room_id = r.id 
           AND ((s.start_ts <= $1 AND s.end_ts > $1) OR (s.start_ts < $2 AND s.end_ts >= $2))
         WHERE r.id = $3
         GROUP BY r.devices`,
        [startTs, endTs, roomId]
      );

      if (roomCapacity.rows.length > 0 && 
          roomCapacity.rows[0].current_sessions >= roomCapacity.rows[0].devices) {
        return res.status(409).json({ error: 'Oda kapasitesi dolu' });
      }
    }

    // Seans oluştur
    const result = await db.query(
      `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [staffId, memberId, roomId, startTs, endTs, note || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: 'Seans oluşturulurken bir hata oluştu' });
  }
});

// Seans güncelle
router.put('/:id', [
  body('staffId').optional().isInt(),
  body('memberId').optional().isInt(),
  body('roomId').optional().isInt(),
  body('startTs').optional().isInt(),
  body('endTs').optional().isInt(),
  body('note').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Seans var mı kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    // Yetki kontrolü (staff sadece kendi seanslarını düzenleyebilir)
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0 && 
          existing.rows[0].staff_id !== staffResult.rows[0].id) {
        return res.status(403).json({ error: 'Bu seansı düzenleme yetkiniz yok' });
      }
    }

    // Güncelleme alanlarını oluştur
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (['staffId', 'memberId', 'roomId', 'startTs', 'endTs', 'note'].includes(key)) {
        const dbKey = key === 'staffId' ? 'staff_id' : 
                     key === 'memberId' ? 'member_id' : 
                     key === 'roomId' ? 'room_id' : 
                     key === 'startTs' ? 'start_ts' : 
                     key === 'endTs' ? 'end_ts' : key;
        updateFields.push(`${dbKey} = $${paramIndex++}`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
    
    const result = await db.query(query, values);
    res.json({ message: 'Seans güncellendi', session: result.rows[0] });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: 'Seans güncellenirken bir hata oluştu' });
  }
});

// Seans sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Seans var mı kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0 && 
          existing.rows[0].staff_id !== staffResult.rows[0].id) {
        return res.status(403).json({ error: 'Bu seansı silme yetkiniz yok' });
      }
    }

    await db.query('DELETE FROM sessions WHERE id = $1', [id]);
    res.json({ message: 'Seans silindi' });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: 'Seans silinirken bir hata oluştu' });
  }
});

// Grup seansları sil (personel bazlı)
router.delete('/group/bulk', [
  body('staffId').isInt(),
  body('startTs').isInt(),
  body('endTs').isInt(),
  body('roomId').optional().isInt()
], async (req, res) => {
  try {
    const { staffId, startTs, endTs, roomId } = req.body;

    let query = `
      DELETE FROM sessions 
      WHERE staff_id = $1 
      AND start_ts = $2 
      AND end_ts = $3
    `;
    const params = [staffId, startTs, endTs];

    if (roomId) {
      query += ' AND room_id = $4';
      params.push(roomId);
    }

    const result = await db.query(query, params);
    res.json({ 
      message: 'Grup seansları silindi',
      deletedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Seanslar silinirken bir hata oluştu' });
  }
});

export default router;
