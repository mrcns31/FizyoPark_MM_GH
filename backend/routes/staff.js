import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { toPhoneFormat } from '../utils/phone.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

// Personel listesi
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM staff ORDER BY first_name, last_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Staff list error:', error);
    res.status(500).json({ error: 'Personel listesi alınırken hata oluştu' });
  }
});

// Yeni personel ekle
router.post('/', [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').optional().trim(),
  body('workingHours').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, phone, workingHours } = req.body;
    const phoneFormatted = phone != null && phone !== '' ? toPhoneFormat(phone) : null;
    if (phone != null && phone !== '' && !phoneFormatted) {
      return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }

    const result = await db.query(
      `INSERT INTO staff (first_name, last_name, phone, working_hours)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [firstName, lastName, phoneFormatted, JSON.stringify(workingHours || {})]
    );
    const created = result.rows[0];
    await activityLog(req, { action: 'staff.create', entityType: 'staff', entityId: created.id, details: { name: `${created.first_name} ${created.last_name}` } }).catch(() => {});

    res.status(201).json(created);
  } catch (error) {
    console.error('Staff create error:', error);
    res.status(500).json({ error: 'Personel eklenirken hata oluştu' });
  }
});

// Personel güncelle
router.put('/:id', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('workingHours').optional().isObject()
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

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

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE staff SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const updated = result.rows[0];
    await activityLog(req, { action: 'staff.update', entityType: 'staff', entityId: id, details: { name: `${updated.first_name} ${updated.last_name}` } }).catch(() => {});
    res.json(updated);
  } catch (error) {
    console.error('Staff update error:', error);
    res.status(500).json({ error: 'Personel güncellenirken hata oluştu' });
  }
});

// Personel sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM staff WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personel bulunamadı' });
    }
    const deleted = result.rows[0];
    await activityLog(req, { action: 'staff.delete', entityType: 'staff', entityId: id, details: { name: `${deleted.first_name} ${deleted.last_name}` } }).catch(() => {});
    res.json({ message: 'Personel silindi' });
  } catch (error) {
    console.error('Staff delete error:', error);
    res.status(500).json({ error: 'Personel silinirken hata oluştu' });
  }
});

export default router;
