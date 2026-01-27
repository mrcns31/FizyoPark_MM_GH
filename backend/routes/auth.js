import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';

const router = express.Router();

// JWT token oluştur
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Giriş yap
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Kullanıcı adı gerekli'),
  body('password').notEmpty().withMessage('Şifre gerekli')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Kullanıcıyı bul
    const result = await db.query(
      'SELECT u.*, s.id as staff_id FROM users u LEFT JOIN staff s ON u.id = s.user_id WHERE u.username = $1 AND u.is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const user = result.rows[0];

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    // Token oluştur
    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        staffId: user.staff_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Giriş yapılırken bir hata oluştu' });
  }
});

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
