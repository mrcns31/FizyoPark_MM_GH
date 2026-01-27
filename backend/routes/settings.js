import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();
router.use(verifyToken);

// Sadece admin ve manager çalışma saatlerini değiştirebilir
const checkAdminOrManager = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};

// Çalışma saatlerini getir
router.get('/working-hours', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM working_hours ORDER BY day_of_week'
    );
    
    // JSON formatına çevir (day_of_week -> key)
    const workingHours = {};
    result.rows.forEach(row => {
      workingHours[row.day_of_week] = {
        enabled: row.enabled,
        start: row.start_time,
        end: row.end_time
      };
    });

    res.json(workingHours);
  } catch (error) {
    console.error('Working hours get error:', error);
    res.status(500).json({ error: 'Çalışma saatleri alınırken hata oluştu' });
  }
});

// Çalışma saatlerini güncelle
router.put('/working-hours', checkAdminOrManager, [
  body().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const workingHours = req.body;

    // Her gün için güncelleme yap
    for (const [dayOfWeek, config] of Object.entries(workingHours)) {
      const day = parseInt(dayOfWeek);
      if (isNaN(day) || day < 0 || day > 6) continue;

      const { enabled, start, end } = config;

      // Var mı kontrol et
      const existing = await db.query(
        'SELECT id FROM working_hours WHERE day_of_week = $1',
        [day]
      );

      if (existing.rows.length > 0) {
        // Güncelle
        await db.query(
          `UPDATE working_hours 
           SET enabled = $1, start_time = $2, end_time = $3 
           WHERE day_of_week = $4`,
          [enabled || false, start || '08:00', end || '20:00', day]
        );
      } else {
        // Ekle
        await db.query(
          `INSERT INTO working_hours (day_of_week, enabled, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
          [day, enabled || false, start || '08:00', end || '20:00']
        );
      }
    }

    res.json({ message: 'Çalışma saatleri güncellendi' });
  } catch (error) {
    console.error('Working hours update error:', error);
    res.status(500).json({ error: 'Çalışma saatleri güncellenirken hata oluştu' });
  }
});

export default router;
