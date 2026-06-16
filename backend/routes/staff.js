import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { toPhoneFormat, phoneDigits, phoneLast4 } from '../utils/phone.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem yalnızca admin tarafından yapılabilir' });
  }
  next();
};

// Personel listesi
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.username AS login_username, u.email AS user_email
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.first_name, s.last_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Staff list error:', error);
    res.status(500).json({ error: 'Personel listesi alınırken hata oluştu' });
  }
});

// Yeni personel ekle (giriş: kullanıcı adı = e-posta, geçici şifre = telefon son 4 hane)
router.post('/', [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').trim().notEmpty().withMessage('Telefon zorunludur'),
  body('email').trim().isEmail().withMessage('Geçerli e-posta girin').normalizeEmail(),
  body('workingHours').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array()[0]?.msg || 'Geçersiz veri';
      return res.status(400).json({ error: msg, errors: errors.array() });
    }

    const { firstName, lastName, phone, email, workingHours } = req.body;
    const phoneFormatted = toPhoneFormat(phone);
    if (!phoneFormatted) {
      return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }

    const digits = phoneDigits(phoneFormatted);
    const initialPassword = phoneLast4(phoneFormatted);
    const username = email;

    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(
        `INSERT INTO users (username, email, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, 'staff', true)
         RETURNING id`,
        [username, email, passwordHash]
      );
      const userId = userRes.rows[0].id;
      const staffRes = await client.query(
        `INSERT INTO staff (user_id, first_name, last_name, phone, working_hours)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, firstName, lastName, phoneFormatted, JSON.stringify(workingHours || {})]
      );
      await client.query('COMMIT');
      const created = staffRes.rows[0];
      created.login_username = username;
      created.user_email = email;
      await activityLog(req, {
        action: 'staff.create',
        entityType: 'staff',
        entityId: created.id,
        details: { name: `${created.first_name} ${created.last_name}`, login_username: username },
      }).catch(() => {});
      res.status(201).json(created);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Staff create error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Bu telefon veya e-posta ile kayıtlı bir hesap zaten var.' });
    }
    res.status(500).json({ error: 'Personel eklenirken hata oluştu' });
  }
});

// Personel şifresini sıfırla (yalnızca admin): geçici şifre = telefon son 4 hane, ilk girişte yenileme zorunlu
router.post('/:id/reset-password', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const staffRes = await db.query(
      `SELECT s.id, s.first_name, s.last_name, s.phone, u.id AS user_id, u.username, u.email
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const staff = staffRes.rows[0];
    if (!staff.user_id) {
      return res.status(400).json({ error: 'Bu personelin giriş hesabı yok.' });
    }
    const initialPassword = phoneLast4(staff.phone);
    if (!initialPassword) {
      return res.status(400).json({ error: 'Geçerli telefon numarası yok; şifre sıfırlanamaz.' });
    }
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, staff.user_id]
    );
    await activityLog(req, {
      action: 'staff.reset_password',
      entityType: 'staff',
      entityId: id,
      details: { name: `${staff.first_name} ${staff.last_name}`, login_username: staff.username },
    }).catch(() => {});
    res.json({
      message: 'Personel şifresi sıfırlandı',
      loginUsername: staff.email || staff.username,
      temporaryPassword: initialPassword,
    });
  } catch (error) {
    console.error('Staff reset password error:', error);
    res.status(500).json({ error: 'Şifre sıfırlanırken hata oluştu' });
  }
});

// Personel güncelle
router.put('/:id', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Geçerli e-posta girin').normalizeEmail(),
  body('workingHours').optional().isObject()
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const staffRow = await db.query('SELECT id, user_id FROM staff WHERE id = $1', [id]);
    if (staffRow.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const userId = staffRow.rows[0].user_id;

    if (updates.email && userId) {
      const existingEmail = await db.query(
        'SELECT id FROM users WHERE (email = $1 OR username = $1) AND id != $2',
        [updates.email, userId]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
      }
      await db.query(
        'UPDATE users SET email = $1, username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [updates.email, userId]
      );
    }

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.firstName) {
      updateFields.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }
    if (updates.lastName) {
      updateFields.push(`last_name = $${paramIndex++}`);
      values.push(updates.lastName);
    }
    if (updates.phone !== undefined) {
      const phoneFormatted = updates.phone != null && updates.phone !== '' ? toPhoneFormat(updates.phone) : null;
      if (updates.phone != null && updates.phone !== '' && !phoneFormatted) {
        return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
      }
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(phoneFormatted);
    }
    if (updates.workingHours) {
      updateFields.push(`working_hours = $${paramIndex++}`);
      values.push(JSON.stringify(updates.workingHours));
    }
    if (updates.cardNo !== undefined) {
      updateFields.push(`card_no = $${paramIndex++}`);
      values.push(updates.cardNo ? String(updates.cardNo).trim() || null : null);
    }

    let updated;
    if (updateFields.length === 0) {
      if (!updates.email) {
        return res.status(400).json({ error: 'Güncellenecek alan yok' });
      }
      const fresh = await db.query('SELECT * FROM staff WHERE id = $1', [id]);
      updated = fresh.rows[0];
    } else {
      values.push(id);
      const query = `UPDATE staff SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await db.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Personel bulunamadı' });
      }
      updated = result.rows[0];
    }
    if (userId) {
      const emailRes = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
      updated.user_email = emailRes.rows[0]?.email || null;
      const userRes = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
      updated.login_username = userRes.rows[0]?.username || null;
    }
    await activityLog(req, { action: 'staff.update', entityType: 'staff', entityId: id, details: { name: `${updated.first_name} ${updated.last_name}` } }).catch(() => {});
    res.json(updated);
  } catch (error) {
    console.error('Staff update error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }
    res.status(500).json({ error: 'Personel güncellenirken hata oluştu' });
  }
});

// Personel sil (bağlı giriş hesabını da sil)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query('SELECT * FROM staff WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const deleted = existing.rows[0];
    const userId = deleted.user_id;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM staff WHERE id = $1', [id]);
      if (userId) {
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await activityLog(req, { action: 'staff.delete', entityType: 'staff', entityId: id, details: { name: `${deleted.first_name} ${deleted.last_name}` } }).catch(() => {});
    res.json({ message: 'Personel silindi' });
  } catch (error) {
    console.error('Staff delete error:', error);
    res.status(500).json({ error: 'Personel silinirken hata oluştu' });
  }
});

export default router;
