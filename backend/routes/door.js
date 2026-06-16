import express from 'express';
import { verifyToken } from './auth.js';

const router = express.Router();

router.use(verifyToken);

router.post('/open', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim' });
  }

  const raspiUrl = process.env.DOOR_RASPI_URL;
  if (!raspiUrl) {
    return res.status(503).json({ error: 'Kapı kontrol adresi yapılandırılmamış (DOOR_RASPI_URL)' });
  }

  try {
    const response = await fetch(raspiUrl, { method: 'POST', signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return res.status(502).json({ error: 'Kapı cihazından hata alındı' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: 'Kapı cihazına bağlanılamadı' });
  }
});

export default router;
