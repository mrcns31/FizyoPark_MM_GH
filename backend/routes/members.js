import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();
router.use(verifyToken);

// Üye listesi
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM members ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Members list error:', error);
    res.status(500).json({ error: 'Üye listesi alınırken hata oluştu' });
  }
});

// Yeni üye ekle
router.post('/', [
  body('name').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, notes } = req.body;

    const result = await db.query(
      `INSERT INTO members (name, phone, email, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, phone || null, email || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Member create error:', error);
    res.status(500).json({ error: 'Üye eklenirken hata oluştu' });
  }
});

// Üye güncelle
router.put('/:id', [
  body('name').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, notes } = req.body;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(phone || null);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      values.push(notes || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE members SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Member update error:', error);
    res.status(500).json({ error: 'Üye güncellenirken hata oluştu' });
  }
});

// Üye sil
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM members WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }

    res.json({ message: 'Üye silindi' });
  } catch (error) {
    console.error('Member delete error:', error);
    res.status(500).json({ error: 'Üye silinirken hata oluştu' });
  }
});

export default router;
