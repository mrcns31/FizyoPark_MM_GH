import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { toPhoneFormat } from '../utils/phone.js';

const router = express.Router();
router.use(verifyToken);

const MEMBER_FIELDS = [
  'member_no', 'first_name', 'last_name', 'phone', 'email',
  'birth_date', 'profession', 'address', 'contact_name', 'contact_phone',
  'systemic_diseases', 'clinical_conditions', 'past_operations', 'notes'
];

// Üye listesi (migration sonrası first_name/last_name/member_no alanları kullanılır)
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

// Yeni üye ekle (Üye No otomatik FP001, FP002...; *Ad/Soyad, *Telefon zorunlu; telefon benzersiz)
router.post('/', [
  body('first_name').trim().notEmpty().withMessage('Ad zorunludur'),
  body('last_name').trim().notEmpty().withMessage('Soyad zorunludur'),
  body('phone').trim().notEmpty().withMessage('Telefon zorunludur')
], async (req, res) => {
  try {
    // Yeni üyede üye numarası her zaman sunucuda otomatik atanır; gelen member_no yok sayılır
    delete req.body.member_no;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(e => e.msg || e.param).join(', ');
      return res.status(400).json({ error: `Geçersiz veri: ${errorMessages}` });
    }

    let phone = toPhoneFormat(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }
    const dup = await db.query(
      'SELECT id FROM members WHERE trim(phone) = $1',
      [phone]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Bu telefon numarası başka bir üyede kayıtlı.' });
    }

    let contact_phone = toPhoneFormat(req.body.contact_phone);
    if (req.body.contact_phone != null && req.body.contact_phone !== '' && !contact_phone) {
      return res.status(400).json({ error: 'Yakını telefonu (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }

    // Otomatik üye numarası: FP001, FP002, ...
    const nextNoResult = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(member_no FROM 3) AS INTEGER)), 0) + 1 AS next_num
       FROM members WHERE member_no ~ '^FP[0-9]+$'`
    );
    const nextNum = parseInt(nextNoResult.rows[0]?.next_num || 1, 10);
    const member_no = 'FP' + String(nextNum).padStart(3, '0');

    const row = {
      member_no,
      first_name: (req.body.first_name || '').trim(),
      last_name: (req.body.last_name || '').trim(),
      phone,
      email: (req.body.email || '').trim() || null,
      birth_date: req.body.birth_date || null,
      profession: (req.body.profession || '').trim() || null,
      address: (req.body.address || '').trim() || null,
      contact_name: (req.body.contact_name || '').trim() || null,
      contact_phone: contact_phone || null,
      systemic_diseases: (req.body.systemic_diseases || '').trim() || null,
      clinical_conditions: (req.body.clinical_conditions || '').trim() || null,
      past_operations: (req.body.past_operations || '').trim() || null,
      notes: (req.body.notes || '').trim() || null
    };
    const name = `${row.first_name} ${row.last_name}`.trim();
    if (!name) {
      return res.status(400).json({ error: 'Ad ve soyad birlikte boş olamaz.' });
    }

    const result = await db.query(
      `INSERT INTO members (
        member_no, first_name, last_name, name, phone, email,
        birth_date, profession, address, contact_name, contact_phone,
        systemic_diseases, clinical_conditions, past_operations, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        row.member_no, row.first_name, row.last_name, name, row.phone, row.email,
        row.birth_date, row.profession, row.address, row.contact_name, row.contact_phone,
        row.systemic_diseases, row.clinical_conditions, row.past_operations, row.notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bu üye numarası veya telefon zaten kayıtlı.' });
    }
    console.error('Member create error:', error);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    
    // Yanıtı güvenli oluştur; her durumda error/code/detail gönder
    const payload = {
      error: String(error.message || 'Üye eklenirken hata oluştu'),
      code: error.code != null ? error.code : undefined,
      detail: error.detail != null ? String(error.detail) : undefined,
      constraint: error.constraint != null ? String(error.constraint) : undefined
    };
    if (!payload.detail && payload.constraint) {
      payload.detail = `Constraint: ${payload.constraint}`;
    }
    res.status(500).json(payload);
  }
});

// Üye güncelle
router.put('/:id', [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg || 'Geçersiz veri' });
    }
    const { id } = req.params;
    let phone = req.body.phone != null ? toPhoneFormat(req.body.phone) : undefined;
    if (req.body.phone != null && req.body.phone !== '' && !phone) {
      return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }
    if (phone !== undefined) {
      const dup = await db.query(
        'SELECT id FROM members WHERE trim(phone) = $1 AND id != $2',
        [phone, id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'Bu telefon numarası başka bir üyede kayıtlı.' });
      }
    }

    let contact_phone = req.body.contact_phone != null ? toPhoneFormat(req.body.contact_phone) : undefined;
    if (req.body.contact_phone != null && req.body.contact_phone !== '' && contact_phone === undefined) {
      return res.status(400).json({ error: 'Yakını telefonu (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
    }

    const updates = req.body;
    const fields = [];
    const values = [];
    let n = 1;
    const set = (col, val) => { fields.push(`${col} = $${n++}`); values.push(val); };
    if (updates.member_no !== undefined) set('member_no', (updates.member_no || '').trim());
    if (updates.first_name !== undefined) set('first_name', (updates.first_name || '').trim());
    if (updates.last_name !== undefined) set('last_name', (updates.last_name || '').trim());
    if (updates.phone !== undefined) set('phone', phone);
    if (updates.email !== undefined) set('email', (updates.email || '').trim() || null);
    if (updates.birth_date !== undefined) set('birth_date', updates.birth_date || null);
    if (updates.profession !== undefined) set('profession', (updates.profession || '').trim() || null);
    if (updates.address !== undefined) set('address', (updates.address || '').trim() || null);
    if (updates.contact_name !== undefined) set('contact_name', (updates.contact_name || '').trim() || null);
    if (updates.contact_phone !== undefined) set('contact_phone', contact_phone ?? null);
    if (updates.systemic_diseases !== undefined) set('systemic_diseases', (updates.systemic_diseases || '').trim() || null);
    if (updates.clinical_conditions !== undefined) set('clinical_conditions', (updates.clinical_conditions || '').trim() || null);
    if (updates.past_operations !== undefined) set('past_operations', (updates.past_operations || '').trim() || null);
    if (updates.notes !== undefined) set('notes', (updates.notes || '').trim() || null);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      const r = await db.query('SELECT first_name, last_name FROM members WHERE id = $1', [id]);
      const fn = updates.first_name ?? r.rows[0]?.first_name ?? '';
      const ln = updates.last_name ?? r.rows[0]?.last_name ?? '';
      set('name', `${fn} ${ln}`.trim());
    }
    values.push(id);
    const q = `UPDATE members SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`;
    const result = await db.query(q, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bu üye numarası veya telefon zaten kayıtlı.' });
    }
    console.error('Member update error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Üye güncellenirken hata oluştu',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
