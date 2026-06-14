import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { CONSENT_VERSION, getConsentStatus, getLegalLinks, setLegalLinks, recordConsent } from '../utils/legalConsent.js';

const router = express.Router();

function buildUserProfile(row) {
  let fullName = row.username;
  if (row.role === 'admin') {
    fullName = 'Admin';
  } else if (row.member_first_name || row.member_last_name) {
    fullName = `${row.member_first_name || ''} ${row.member_last_name || ''}`.trim();
  } else if (row.first_name || row.last_name) {
    fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  }
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    staffId: row.staff_id ?? null,
    memberId: row.member_id ?? null,
    mustChangePassword: !!row.must_change_password,
    fullName,
    phone: row.phone || row.member_phone || null
  };
}

// JWT token oluştur
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Token doğrula (middleware için)
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Giriş yap
router.post('/login', [
  body('email').trim().notEmpty().withMessage('E-posta gerekli'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const loginEmail = String(email).trim();

    const result = await db.query(
      `SELECT u.*, s.id AS staff_id, s.first_name, s.last_name, s.phone,
              m.id AS member_id, m.first_name AS member_first_name, m.last_name AS member_last_name,
              m.phone AS member_phone
       FROM users u
       LEFT JOIN staff s ON u.id = s.user_id
       LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
       WHERE u.is_active = true AND (u.username = $1 OR LOWER(u.email) = LOWER($1))`,
      [loginEmail]
    );

    if (result.rows.length === 0) {
      await activityLog(req, { action: 'auth.login_failed', details: { email: loginEmail, reason: 'user_not_found' } }).catch(() => {});
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await activityLog(req, { action: 'auth.login_failed', details: { email: loginEmail, reason: 'invalid_password' } }).catch(() => {});
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    // Token oluştur
    const token = generateToken(user.id, user.role);

    await activityLog(req, {
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      details: { role: user.role },
      actorId: user.id,
      actorType: 'user',
      actorName: user.username
    }).catch(() => {});

    res.json({
      token,
      user: {
        ...buildUserProfile(user),
        ...(await getConsentStatus(user.id)),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş yapılırken bir hata oluştu' });
  }
});

// Oturum açmış kullanıcı bilgisi
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.must_change_password,
              s.id AS staff_id, s.first_name, s.last_name, s.phone,
              m.id AS member_id, m.first_name AS member_first_name, m.last_name AS member_last_name,
              m.phone AS member_phone
       FROM users u
       LEFT JOIN staff s ON s.user_id = u.id
       LEFT JOIN members m ON m.user_id = u.id AND (m.deleted_at IS NULL)
       WHERE u.id = $1 AND u.is_active = true`,
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    res.json({
      ...buildUserProfile(result.rows[0]),
      ...(await getConsentStatus(req.user.userId)),
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Kullanıcı bilgisi alınırken hata oluştu' });
  }
});

// İlk girişte şifre belirleme (must_change_password=true iken)
router.post('/set-password', verifyToken, [
  body('newPassword').isLength({ min: 4 }).withMessage('Şifre en az 4 karakter olmalı'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Şifreler eşleşmiyor');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg });
    }

    const userRes = await db.query('SELECT id, must_change_password FROM users WHERE id = $1', [req.user.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    if (!userRes.rows[0].must_change_password) {
      return res.status(400).json({ error: 'Şifre zaten belirlenmiş. Bu işlem yalnızca ilk giriş içindir.' });
    }

    const { newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, req.user.userId]
    );

    await activityLog(req, {
      action: 'auth.set_password',
      entityType: 'user',
      entityId: req.user.userId,
      actorId: req.user.userId,
      actorType: 'user'
    }).catch(() => {});

    res.json({ message: 'Şifreniz kaydedildi', mustChangePassword: false });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Şifre kaydedilirken hata oluştu' });
  }
});

// Giriş yapmış kullanıcı şifre değiştirme (admin profil vb.)
router.post('/change-password', verifyToken, [
  body('currentPassword').notEmpty().withMessage('Mevcut şifre gerekli'),
  body('newPassword').isLength({ min: 4 }).withMessage('Yeni şifre en az 4 karakter olmalı'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Şifreler eşleşmiyor');
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg });
    }

    const { currentPassword, newPassword } = req.body;
    const userRes = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND is_active = true',
      [req.user.userId]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    await activityLog(req, {
      action: 'auth.change_password',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
      actorType: 'user'
    }).catch(() => {});

    res.json({ message: 'Şifreniz güncellendi' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Şifre güncellenirken hata oluştu' });
  }
});

// Token yenile
router.post('/refresh', verifyToken, (req, res) => {
  const newToken = generateToken(req.user.userId, req.user.role);
  res.json({ token: newToken });
});

// Çıkış yap (client-side token silinir)
router.post('/logout', verifyToken, (req, res) => {
  res.json({ message: 'Başarıyla çıkış yapıldı' });
});

export default router;
