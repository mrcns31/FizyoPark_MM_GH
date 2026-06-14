import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { applyClosurePeriod, listClosurePeriods, deleteClosurePeriod } from '../utils/closurePeriods.js';
import { localDateStrFromTs } from '../utils/staffWorkingHours.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
}

// Admin: kapanış dönemleri listesi
router.get('/', requireAdmin, async (req, res) => {
  try {
    const closurePeriods = await listClosurePeriods(db);
    res.json({ closurePeriods });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Kapanış günleri henüz etkin değil. migration_closure_periods.sql çalıştırın.' });
    }
    console.error('Closure periods list error:', error);
    res.status(500).json({ error: 'Kapanış günleri listelenirken hata oluştu' });
  }
});

// Admin: yeni kapanış dönemi kaydet ve etkilerini uygula
router.post('/', requireAdmin, [
  body('startDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('endDate').isString().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('description').isString().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { startDate, endDate } = req.body;
    const description = req.body.description.trim();

    if (endDate < startDate) {
      return res.status(400).json({ error: 'Bitiş tarihi başlangıç tarihinden önce olamaz' });
    }
    const todayStr = localDateStrFromTs(Date.now());
    if (startDate < todayStr) {
      return res.status(400).json({ error: 'Geçmiş tarihli kapanış girilemez' });
    }

    const result = await applyClosurePeriod(db, {
      startDate,
      endDate,
      description,
      createdBy: req.user.userId,
    });

    await activityLog(req, {
      action: 'closure_period.create',
      entityType: 'closure_period',
      entityId: result.closurePeriod.id,
      details: { startDate, endDate, description, summary: result.summary },
    }).catch(() => {});

    res.status(201).json(result);
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Kapanış günleri henüz etkin değil. migration_closure_periods.sql çalıştırın.' });
    }
    console.error('Closure period create error:', error);
    res.status(500).json({ error: 'Kapanış günü kaydedilirken hata oluştu' });
  }
});

// Admin: kapanış kaydını sil (etkiler geri alınmaz)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteClosurePeriod(db, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Kapanış kaydı bulunamadı' });
    }
    await activityLog(req, {
      action: 'closure_period.delete',
      entityType: 'closure_period',
      entityId: deleted.id,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    console.error('Closure period delete error:', error);
    res.status(500).json({ error: 'Kapanış kaydı silinirken hata oluştu' });
  }
});

export default router;
