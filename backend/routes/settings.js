import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { getInstitutionWhatsApp, setInstitutionWhatsApp, getStaffCalendarRange, setStaffCalendarRange, clearStaffCalendarRange } from '../utils/appSettings.js';

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

    await activityLog(req, { action: 'settings.working_hours_update', entityType: 'settings', details: { daysUpdated: Object.keys(workingHours).length } }).catch(() => {});
    res.json({ message: 'Çalışma saatleri güncellendi' });
  } catch (error) {
    console.error('Working hours update error:', error);
    res.status(500).json({ error: 'Çalışma saatleri güncellenirken hata oluştu' });
  }
});

// Kurum WhatsApp numarası (üye iptal sonrası yönlendirme)
router.get('/institution-whatsapp', async (req, res) => {
  try {
    const whatsapp = await getInstitutionWhatsApp();
    res.json({ whatsapp: whatsapp || '' });
  } catch (error) {
    console.error('Institution WhatsApp get error:', error);
    res.status(500).json({ error: 'Kurum WhatsApp numarası alınırken hata oluştu' });
  }
});

router.put('/institution-whatsapp', checkAdminOrManager, [
  body('whatsapp').optional({ nullable: true }).isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const raw = req.body?.whatsapp;
    if (raw == null || String(raw).trim() === '') {
      await db.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('institution_whatsapp', NULL, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = NULL, updated_at = CURRENT_TIMESTAMP`
      );
      await activityLog(req, {
        action: 'settings.institution_whatsapp_clear',
        entityType: 'settings',
        details: {},
      }).catch(() => {});
      return res.json({ whatsapp: '', message: 'Kurum WhatsApp numarası temizlendi' });
    }
    const saved = await setInstitutionWhatsApp(raw);
    await activityLog(req, {
      action: 'settings.institution_whatsapp_update',
      entityType: 'settings',
      details: { whatsapp: saved },
    }).catch(() => {});
    res.json({ whatsapp: saved, message: 'Kurum WhatsApp numarası kaydedildi' });
  } catch (error) {
    if (error.code === 'INVALID_WHATSAPP') {
      return res.status(400).json({
        error: 'Geçerli bir WhatsApp numarası girin (ülke kodu ile, 10–15 hane).',
      });
    }
    if (error.code === '42P01') {
      return res.status(503).json({
        error: 'Ayarlar tablosu henüz etkin değil. Lütfen migration_app_settings.sql çalıştırın.',
      });
    }
    console.error('Institution WhatsApp update error:', error);
    res.status(500).json({ error: 'Kurum WhatsApp numarası kaydedilirken hata oluştu' });
  }
});

router.get('/staff-calendar-range', async (req, res) => {
  try {
    const range = await getStaffCalendarRange();
    res.json(range || { daysBefore: null, daysAfter: null });
  } catch (error) {
    console.error('Staff calendar range get error:', error);
    res.status(500).json({ error: 'Ayar alınırken hata oluştu' });
  }
});

router.delete('/staff-calendar-range', checkAdminOrManager, async (req, res) => {
  try {
    await clearStaffCalendarRange();
    await activityLog(req, { action: 'settings.staff_calendar_range_clear', entityType: 'settings', details: {} }).catch(() => {});
    res.json({ daysBefore: null, daysAfter: null });
  } catch (error) {
    console.error('Staff calendar range clear error:', error);
    res.status(500).json({ error: 'Ayar silinemedi' });
  }
});

router.put('/staff-calendar-range', checkAdminOrManager, [
  body('daysBefore').isInt({ min: 0, max: 365 }),
  body('daysAfter').isInt({ min: 0, max: 365 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    const { daysBefore, daysAfter } = req.body;
    await setStaffCalendarRange(daysBefore, daysAfter);
    await activityLog(req, { action: 'settings.staff_calendar_range_update', entityType: 'settings', details: { daysBefore, daysAfter } }).catch(() => {});
    res.json({ daysBefore, daysAfter });
  } catch (error) {
    console.error('Staff calendar range update error:', error);
    res.status(500).json({ error: 'Ayar kaydedilirken hata oluştu' });
  }
});

export default router;
