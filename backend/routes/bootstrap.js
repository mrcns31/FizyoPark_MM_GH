import express from 'express';
import { query, validationResult } from 'express-validator';
import { verifyToken } from './auth.js';
import { loadAdminBootstrap } from '../utils/adminBootstrap.js';

const router = express.Router();

router.use(verifyToken);

router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
});

router.get('/', [
  query('startDate').notEmpty().isISO8601().withMessage('startDate gerekli'),
  query('endDate').notEmpty().isISO8601().withMessage('endDate gerekli'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    const payload = await loadAdminBootstrap({
      startDate,
      endDate,
      user: req.user,
    });
    res.json(payload);
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Uygulama verisi yüklenirken hata oluştu' });
  }
});

export default router;
