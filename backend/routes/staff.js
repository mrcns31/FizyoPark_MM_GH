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

// Personel listesi — ?includeDeleted=true ile silinmiş personel de döner (sadece admin)
router.get('/', async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true' && req.user.role === 'admin';
  try {
    let result;
    try {
      const whereClause = includeDeleted ? '' : 'WHERE s.deleted_at IS NULL';
      result = await db.query(
        `SELECT s.*, u.username AS login_username, u.email AS user_email
         FROM staff s
         LEFT JOIN users u ON u.id = s.user_id
         ${whereClause}
         ORDER BY s.first_name, s.last_name`
      );
    } catch (colErr) {
      if (colErr.code === '42703') {
        result = await db.query(
          `SELECT s.*, u.username AS login_username, u.email AS user_email
           FROM staff s
           LEFT JOIN users u ON u.id = s.user_id
           ORDER BY s.first_name, s.last_name`
        );
      } else throw colErr;
    }
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

// Personel sil (admin şifresi zorunlu; soft delete - veritabanında kalır)
router.delete('/:id', [
  body('adminPassword').notEmpty().withMessage('Admin şifresi gerekli'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array().map(e => e.msg).join(', ') });
    }
    const { id } = req.params;
    const { adminPassword } = req.body;

    // Admin şifresini doğrula
    const adminResult = await db.query(
      "SELECT password_hash FROM users WHERE role = 'admin' AND is_active = true LIMIT 1"
    );
    if (adminResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin hesabı bulunamadı.' });
    }
    const valid = await bcrypt.compare(adminPassword, adminResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Admin şifresi hatalı.' });
    }

    let existing;
    try {
      existing = await db.query('SELECT * FROM staff WHERE id = $1 AND deleted_at IS NULL', [id]);
    } catch (colErr) {
      if (colErr.code === '42703') {
        return res.status(503).json({ error: 'Silme özelliği için migration gerekli. migration_staff_deleted_at.sql çalıştırın.' });
      }
      throw colErr;
    }
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const staffRow = existing.rows[0];
    const userId = staffRow.user_id;

    // Soft delete: personel kaydı silinmez, deleted_at işaretlenir; giriş hesabı devre dışı bırakılır
    await db.query('UPDATE staff SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    if (userId) {
      await db.query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    }

    await activityLog(req, { action: 'staff.delete', entityType: 'staff', entityId: id, details: { name: `${staffRow.first_name} ${staffRow.last_name}`, softDelete: true } }).catch(() => {});
    res.json({ message: 'Personel silindi' });
  } catch (error) {
    console.error('Staff delete error:', error);
    res.status(500).json({ error: 'Personel silinirken hata oluştu' });
  }
});

// Eski (soft-silinmiş) personeli tekrar aktif et: eski şifre geçersiz olur,
// telefon son 4 hane geçici şifre olarak atanır ve ilk girişte değiştirme zorunlu kılınır
// (üye reaktivasyonundaki davranışla aynı).
router.post('/:id/reactivate', checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const staffRes = await db.query(
      `SELECT s.*, u.id AS user_id, u.username, u.email
       FROM staff s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.deleted_at IS NOT NULL`,
      [id]
    );
    if (staffRes.rows.length === 0) {
      return res.status(404).json({ error: 'Eski personel kaydı bulunamadı veya zaten aktif.' });
    }
    const staff = staffRes.rows[0];

    await db.query('UPDATE staff SET deleted_at = NULL WHERE id = $1', [id]);

    let tempPasswordInfo = {};
    if (staff.user_id) {
      const initialPassword = phoneLast4(staff.phone);
      if (initialPassword) {
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await db.query(
          `UPDATE users SET password_hash = $1, must_change_password = true, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [passwordHash, staff.user_id]
        );
        tempPasswordInfo = { loginUsername: staff.email || staff.username, temporaryPassword: initialPassword };
      } else {
        await db.query(
          `UPDATE users SET is_active = true, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [staff.user_id]
        );
      }
    }

    const refreshed = await db.query(
      `SELECT s.*, u.username AS login_username, u.email AS user_email
       FROM staff s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1`,
      [id]
    );
    const row = refreshed.rows[0];

    await activityLog(req, {
      action: 'staff.reactivate',
      entityType: 'staff',
      entityId: id,
      details: { name: `${staff.first_name} ${staff.last_name}`, login_username: staff.username },
    }).catch(() => {});

    res.json({ ...row, ...tempPasswordInfo });
  } catch (error) {
    console.error('Staff reactivate error:', error);
    res.status(500).json({ error: 'Personel tekrar aktif edilirken hata oluştu' });
  }
});

export default router;
