import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { toPhoneFormat, phoneDigits } from '../utils/phone.js';
import { ensureMemberUserAccount, resetMemberPassword } from '../utils/memberAccount.js';
import { log as activityLog } from '../utils/activityLogger.js';

/** Email boşsa telefon numarasından otomatik üret: 5321234567@fizyopark.com */
function buildMemberEmail(email, phone) {
  const trimmed = (email || '').trim();
  if (trimmed) return trimmed;
  const digits = phoneDigits(phone);
  return digits ? `${digits}@fizyopark.com` : null;
}

const router = express.Router();
router.use(verifyToken);

const blockMemberRole = (req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
};
router.use(blockMemberRole);

const MEMBER_FIELDS = [
  'member_no', 'first_name', 'last_name', 'phone', 'email',
  'birth_date', 'profession', 'address', 'contact_name', 'contact_phone',
  'systemic_diseases', 'clinical_conditions', 'past_operations', 'notes'
];

// Üye listesi (silinmemiş üyeler; deleted_at sütunu yoksa tümü döner)
router.get('/', async (req, res) => {
  try {
    let result;
    try {
      result = await db.query(
        `SELECT * FROM members WHERE (deleted_at IS NULL) ORDER BY name`
      );
    } catch (colErr) {
      if (colErr.code === '42703') {
        result = await db.query('SELECT * FROM members ORDER BY name');
      } else throw colErr;
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Members list error:', error);
    res.status(500).json({ error: 'Üye listesi alınırken hata oluştu' });
  }
});

// Eski üyeler: üyeliği iptal edilmiş (soft delete) kayıtlar
// ?name=Ayşe&phone=053... ile arama yapılabilir; parametresiz çağrılırsa tüm liste döner
router.get('/former', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    const { name, phone } = req.query;
    const params = [];
    const conditions = ['m.deleted_at IS NOT NULL'];

    if (name && name.trim()) {
      params.push(`%${name.trim().toLowerCase()}%`);
      conditions.push(`lower(COALESCE(m.name, m.first_name || ' ' || m.last_name, '')) LIKE $${params.length}`);
    }
    if (phone && phone.trim()) {
      params.push(`%${phone.trim().replace(/\D/g, '')}%`);
      conditions.push(`regexp_replace(COALESCE(m.phone,''), '\\D', '', 'g') LIKE $${params.length}`);
    }

    // Arama parametresi yoksa boş dizi döndür (tüm listeyi yükleme)
    if (!name && !phone) {
      return res.json([]);
    }

    let result;
    try {
      result = await db.query(
        `SELECT m.*,
                (SELECT COUNT(*)::int FROM member_packages mp WHERE mp.member_id = m.id) AS package_count,
                (SELECT COUNT(*)::int FROM sessions s WHERE s.member_id = m.id AND (s.deleted_at IS NULL)) AS session_count
         FROM members m
         WHERE ${conditions.join(' AND ')}
         ORDER BY m.name ASC
         LIMIT 20`,
        params
      );
    } catch (colErr) {
      if (colErr.code === '42703') return res.json([]);
      throw colErr;
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Former members list error:', error);
    res.status(500).json({ error: 'Eski üyeler listelenirken hata oluştu' });
  }
});

// Eski üyenin paket geçmişi (yeniden kayıt öncesi inceleme)
router.get('/former/:id/packages', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    const { id } = req.params;
    const memberRes = await db.query('SELECT * FROM members WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Eski üye kaydı bulunamadı' });
    }
    const packagesRes = await db.query(
      `SELECT mp.*, p.name AS package_name, p.lesson_count, p.package_type
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       WHERE mp.member_id = $1
       ORDER BY mp.start_date DESC`,
      [id]
    );
    res.json({ member: memberRes.rows[0], packages: packagesRes.rows });
  } catch (error) {
    console.error('Former member packages error:', error);
    res.status(500).json({ error: 'Eski üye paketleri alınırken hata oluştu' });
  }
});

// Bekleyen üyelik iptal talepleri (admin)
router.get('/deletion-requests', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    let result;
    try {
      result = await db.query(
        `SELECT id, member_no, first_name, last_name, name, phone, email, deletion_requested_at
         FROM members
         WHERE deletion_requested_at IS NOT NULL AND (deleted_at IS NULL)
         ORDER BY deletion_requested_at ASC`
      );
    } catch (colErr) {
      if (colErr.code === '42703') {
        return res.json([]);
      }
      throw colErr;
    }
    res.json(result.rows.map((row) => ({
      id: row.id,
      memberNo: row.member_no || '',
      memberName: (row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim()) || '',
      phone: row.phone || '',
      email: row.email || '',
      deletionRequestedAt: row.deletion_requested_at
        ? new Date(row.deletion_requested_at).toISOString()
        : null,
    })));
  } catch (error) {
    console.error('Deletion requests list error:', error);
    res.status(500).json({ error: 'İptal talepleri alınırken hata oluştu' });
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

    // Kart kontrolü ÖNCE yapılır — silinmiş üyelerdeki kartlar da geçerli sayılır (DB unique index tüm satırlara bakar)
    const cardNo = (req.body.card_no || '').trim() || null;
    if (cardNo) {
      const cardDup = await db.query(
        'SELECT id, name, deleted_at FROM members WHERE card_no = $1',
        [cardNo]
      );
      if (cardDup.rows.length > 0) {
        const cardOwner = cardDup.rows[0];
        const ownerLabel = cardOwner.name + (cardOwner.deleted_at ? ' (eski üye)' : '');
        return res.status(409).json({ error: `Bu kart numarası başka bir üyeye (${ownerLabel}) tanımlı.` });
      }
    }

    const dup = await db.query(
      'SELECT id, deleted_at, member_no, first_name, last_name, name FROM members WHERE trim(phone) = $1',
      [phone]
    );
    if (dup.rows.length > 0) {
      const existing = dup.rows[0];
      if (existing.deleted_at) {
        return res.status(409).json({
          error: 'Bu telefon numarası eski bir üyeye ait. Eski kaydı geri açarak geçmiş paket ve seansları koruyabilirsiniz.',
          code: 'FORMER_MEMBER',
          formerMember: {
            id: existing.id,
            memberNo: existing.member_no,
            name: existing.name || `${existing.first_name || ''} ${existing.last_name || ''}`.trim(),
            deletedAt: existing.deleted_at ? new Date(existing.deleted_at).toISOString() : null,
          },
        });
      }
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
      email: buildMemberEmail(req.body.email, phone),
      birth_date: req.body.birth_date || null,
      profession: (req.body.profession || '').trim() || null,
      address: (req.body.address || '').trim() || null,
      contact_name: (req.body.contact_name || '').trim() || null,
      contact_phone: contact_phone || null,
      systemic_diseases: (req.body.systemic_diseases || '').trim() || null,
      clinical_conditions: (req.body.clinical_conditions || '').trim() || null,
      past_operations: (req.body.past_operations || '').trim() || null,
      notes: (req.body.notes || '').trim() || null,
      card_no: cardNo
    };
    const name = `${row.first_name} ${row.last_name}`.trim();
    if (!name) {
      return res.status(400).json({ error: 'Ad ve soyad birlikte boş olamaz.' });
    }

    const result = await db.query(
      `INSERT INTO members (
        member_no, first_name, last_name, name, phone, email,
        birth_date, profession, address, contact_name, contact_phone,
        systemic_diseases, clinical_conditions, past_operations, notes, card_no
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        row.member_no, row.first_name, row.last_name, name, row.phone, row.email,
        row.birth_date, row.profession, row.address, row.contact_name, row.contact_phone,
        row.systemic_diseases, row.clinical_conditions, row.past_operations, row.notes, row.card_no
      ]
    );
    let created = result.rows[0];
    if (created.email && created.phone) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await ensureMemberUserAccount(client, created);
        await client.query('COMMIT');
        const refreshed = await db.query('SELECT * FROM members WHERE id = $1', [created.id]);
        created = refreshed.rows[0] || created;
      } catch (accErr) {
        await client.query('ROLLBACK');
        if (accErr.code === 'EMAIL_TAKEN') {
          return res.status(409).json({ error: accErr.message });
        }
        throw accErr;
      } finally {
        client.release();
      }
    }
    // Kart numarası varsa member_cards'a da ekle
    if (cardNo) {
      await db.query(
        'INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,true) ON CONFLICT (card_no) DO UPDATE SET member_id=$1',
        [created.id, cardNo]
      );
    }

    await activityLog(req, { action: 'member.create', entityType: 'member', entityId: created.id, details: { member_no: created.member_no, name: created.name } }).catch(() => {});

    res.status(201).json(created);
  } catch (error) {
    if (error.code === '23505') {
      const msg = (error.constraint || '').includes('card')
        ? 'Bu kart numarası başka bir üyeye tanımlı.'
        : 'Bu üye numarası veya telefon zaten kayıtlı.';
      return res.status(409).json({ error: msg });
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
    if (updates.email !== undefined) {
      // Mevcut telefonu al: güncellenmiyorsa DB'den çek
      const effectivePhone = phone ?? (await db.query('SELECT phone FROM members WHERE id = $1', [id])).rows[0]?.phone;
      set('email', buildMemberEmail(updates.email, effectivePhone));
    }
    if (updates.birth_date !== undefined) set('birth_date', updates.birth_date || null);
    if (updates.profession !== undefined) set('profession', (updates.profession || '').trim() || null);
    if (updates.address !== undefined) set('address', (updates.address || '').trim() || null);
    if (updates.contact_name !== undefined) set('contact_name', (updates.contact_name || '').trim() || null);
    if (updates.contact_phone !== undefined) set('contact_phone', contact_phone ?? null);
    if (updates.systemic_diseases !== undefined) set('systemic_diseases', (updates.systemic_diseases || '').trim() || null);
    if (updates.clinical_conditions !== undefined) set('clinical_conditions', (updates.clinical_conditions || '').trim() || null);
    if (updates.past_operations !== undefined) set('past_operations', (updates.past_operations || '').trim() || null);
    if (updates.notes !== undefined) set('notes', (updates.notes || '').trim() || null);
    if (updates.card_no !== undefined) {
      const newCardNo = (updates.card_no || '').trim() || null;
      if (newCardNo) {
        // members.card_no çakışma kontrolü
        const cardDup = await db.query(
          'SELECT id, name, deleted_at FROM members WHERE card_no = $1 AND id != $2',
          [newCardNo, id]
        );
        if (cardDup.rows.length > 0) {
          const cardOwner = cardDup.rows[0];
          const ownerLabel = cardOwner.name + (cardOwner.deleted_at ? ' (eski üye)' : '');
          return res.status(409).json({ error: `Bu kart numarası başka bir üyeye (${ownerLabel}) tanımlı.` });
        }
        // member_cards çakışma kontrolü
        const mcDup = await db.query(
          'SELECT mc.card_no, m.name, m.deleted_at FROM member_cards mc JOIN members m ON m.id=mc.member_id WHERE mc.card_no=$1 AND mc.member_id!=$2',
          [newCardNo, id]
        );
        if (mcDup.rows.length > 0) {
          const ownerLabel = mcDup.rows[0].name + (mcDup.rows[0].deleted_at ? ' (eski üye)' : '');
          return res.status(409).json({ error: `Bu kart numarası başka bir üyeye (${ownerLabel}) tanımlı.` });
        }
      }
      set('card_no', newCardNo);
    }

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
    let updated = result.rows[0];

    // card_no değiştiyse member_cards tablosunu da senkronize et
    if (updates.card_no !== undefined) {
      const newCardNo = (updates.card_no || '').trim() || null;
      await db.query('DELETE FROM member_cards WHERE member_id = $1', [id]);
      if (newCardNo) {
        await db.query(
          'INSERT INTO member_cards (member_id, card_no, is_primary) VALUES ($1,$2,true) ON CONFLICT (card_no) DO UPDATE SET member_id=$1',
          [id, newCardNo]
        );
      }
    }
    if (updated.email && updated.phone) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await ensureMemberUserAccount(client, updated);
        await client.query('COMMIT');
        const refreshed = await db.query('SELECT * FROM members WHERE id = $1', [updated.id]);
        updated = refreshed.rows[0] || updated;
      } catch (accErr) {
        await client.query('ROLLBACK');
        if (accErr.code === 'EMAIL_TAKEN') {
          return res.status(409).json({ error: accErr.message });
        }
        throw accErr;
      } finally {
        client.release();
      }
    }
    await activityLog(req, { action: 'member.update', entityType: 'member', entityId: updated.id, details: { member_no: updated.member_no, name: updated.name } }).catch(() => {});
    res.json(updated);
  } catch (error) {
    if (error.code === '23505') {
      const msg = (error.constraint || '').includes('card')
        ? 'Bu kart numarası başka bir üyeye tanımlı.'
        : 'Bu üye numarası veya telefon zaten kayıtlı.';
      return res.status(409).json({ error: msg });
    }
    if (error.code === 'CARD_TAKEN') {
      return res.status(409).json({ error: error.message });
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

// Üye giriş şifresini sıfırla (yalnızca admin): geçici şifre = telefon son 4 hane
router.post('/:id/reset-password', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem yalnızca admin tarafından yapılabilir' });
    }
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await resetMemberPassword(client, id);
      if (!result) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Giriş hesabı oluşturulamadı. E-posta ve telefon (10 hane) kayıtlı olmalı.' });
      }
      await client.query('COMMIT');
      await activityLog(req, { action: 'member.reset_password', entityType: 'member', entityId: id }).catch(() => {});
      res.json({
        message: 'Üye şifresi sıfırlandı',
        loginUsername: result.loginUsername,
        temporaryPassword: result.temporaryPassword,
        temporaryPasswordHint: 'Telefon numarasının son 4 hanesi',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Member reset password error:', error);
    res.status(500).json({ error: 'Şifre sıfırlanırken hata oluştu' });
  }
});

// Üye sil (admin şifresi zorunlu; deleteHistory: true ise tam silme, false ise soft delete)
router.delete('/:id', [
  body('adminPassword').notEmpty().withMessage('Admin şifresi gerekli'),
  body('deleteHistory').isBoolean().withMessage('deleteHistory true/false olmalı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array().map(e => e.msg).join(', ') });
    }
    const { id } = req.params;
    const { adminPassword, deleteHistory } = req.body;

    // Admin kullanıcı şifresini doğrula
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

    const memberCheck = await db.query('SELECT id, user_id FROM members WHERE id = $1', [id]);
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }
    const memberUserId = memberCheck.rows[0].user_id;

    if (deleteHistory === true) {
      // Tam silme: üye kaydı + giriş hesabı silinir; seanslar soft delete (veritabanında kalır, log için)
      await db.query('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE member_id = $1', [id]);
      await db.query('DELETE FROM member_cards WHERE member_id = $1', [id]);
      await db.query('DELETE FROM members WHERE id = $1', [id]);
      if (memberUserId) {
        await db.query("DELETE FROM users WHERE id = $1 AND role = 'member'", [memberUserId]);
      }
      await activityLog(req, { action: 'member.delete_permanent', entityType: 'member', entityId: id, details: { deleteHistory: true } }).catch(() => {});
      return res.json({ message: 'Üye ve geçmiş bilgileri silindi' });
    }

    // Soft delete: listede görünmez, kart numaraları çakışmasın diye temizlenir
    await db.query('DELETE FROM member_cards WHERE member_id = $1', [id]);
    await db.query(
      'UPDATE members SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    if (memberUserId) {
      // Giriş hesabını kapat: aktif oturum bir sonraki istekte 401 alır (verifyToken),
      // üye yeniden aktif edilmediği müddetçe login de engellenir.
      await db.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [memberUserId]
      );
    }
    await activityLog(req, { action: 'member.delete', entityType: 'member', entityId: id, details: { softDelete: true } }).catch(() => {});
    res.json({ message: 'Üye silindi (sistemde görünmeyecek)' });
  } catch (error) {
    console.error('Member delete error:', error);
    res.status(500).json({ error: 'Üye silinirken hata oluştu' });
  }
});

// Üyelik iptal talebini onayla (yalnızca admin): soft delete + giriş hesabını kapat
router.post('/:id/approve-deletion-request', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem yalnızca admin tarafından yapılabilir' });
    }
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      let memberRes;
      try {
        memberRes = await client.query(
          'SELECT id, user_id, deletion_requested_at FROM members WHERE id = $1 AND (deleted_at IS NULL)',
          [id]
        );
      } catch (colErr) {
        if (colErr.code === '42703') {
          await client.query('ROLLBACK');
          return res.status(503).json({
            error: 'Üyelik iptal talebi henüz etkin değil. Lütfen migration_members_deletion_request.sql çalıştırın.',
          });
        }
        throw colErr;
      }
      if (memberRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Üye bulunamadı' });
      }
      const member = memberRes.rows[0];
      if (!member.deletion_requested_at) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Bu üye için bekleyen iptal talebi yok' });
      }

      await client.query('DELETE FROM member_cards WHERE member_id = $1', [id]);
      await client.query(
        `UPDATE members
         SET deleted_at = CURRENT_TIMESTAMP, deletion_requested_at = NULL
         WHERE id = $1`,
        [id]
      );
      if (member.user_id) {
        await client.query(
          'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [member.user_id]
        );
      }
      await client.query('COMMIT');

      await activityLog(req, {
        action: 'member.approve_deletion_request',
        entityType: 'member',
        entityId: id,
        details: { softDelete: true },
      }).catch(() => {});

      res.json({ message: 'Üyelik iptali onaylandı; üye listeden kaldırıldı' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Approve deletion request error:', error);
    res.status(500).json({ error: 'Üyelik iptali onaylanırken hata oluştu' });
  }
});

// Üyelik iptal talebini reddet (yalnızca admin)
router.post('/:id/reject-deletion-request', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem yalnızca admin tarafından yapılabilir' });
    }
    const { id } = req.params;
    let result;
    try {
      result = await db.query(
        `UPDATE members SET deletion_requested_at = NULL
         WHERE id = $1 AND (deleted_at IS NULL) AND deletion_requested_at IS NOT NULL
         RETURNING id`,
        [id]
      );
    } catch (colErr) {
      if (colErr.code === '42703') {
        return res.status(503).json({
          error: 'Üyelik iptal talebi henüz etkin değil. Lütfen migration_members_deletion_request.sql çalıştırın.',
        });
      }
      throw colErr;
    }
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Bu üye için bekleyen iptal talebi yok' });
    }

    await activityLog(req, {
      action: 'member.reject_deletion_request',
      entityType: 'member',
      entityId: id,
    }).catch(() => {});

    res.json({ message: 'Üyelik iptal talebi reddedildi' });
  } catch (error) {
    console.error('Reject deletion request error:', error);
    res.status(500).json({ error: 'Üyelik iptal talebi reddedilirken hata oluştu' });
  }
});

// Eski üyeyi tekrar aktif et (aynı member_id → paket/seans geçmişi korunur)
router.post('/:id/reactivate', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const memberRes = await client.query('SELECT * FROM members WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
      if (memberRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Eski üye kaydı bulunamadı veya zaten aktif' });
      }
      let member = memberRes.rows[0];

      const body = req.body || {};
      const fields = [];
      const values = [];
      let n = 1;
      const setField = (col, val) => { fields.push(`${col} = $${n++}`); values.push(val); };

      if (body.first_name !== undefined) setField('first_name', String(body.first_name || '').trim());
      if (body.last_name !== undefined) setField('last_name', String(body.last_name || '').trim());
      if (body.phone !== undefined) {
        const newPhone = toPhoneFormat(body.phone);
        if (!newPhone) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Telefon (xxx)xxx-xx-xx formatında olmalı, 10 hane.' });
        }
        const phoneDup = await client.query(
          'SELECT id FROM members WHERE trim(phone) = $1 AND id != $2 AND deleted_at IS NULL',
          [newPhone, id]
        );
        if (phoneDup.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu telefon numarası başka bir aktif üyede kayıtlı.' });
        }
        setField('phone', newPhone);
      }
      if (body.email !== undefined) setField('email', String(body.email || '').trim() || null);
      if (body.birth_date !== undefined) setField('birth_date', body.birth_date || null);
      if (body.profession !== undefined) setField('profession', String(body.profession || '').trim() || null);
      if (body.address !== undefined) setField('address', String(body.address || '').trim() || null);
      if (body.contact_name !== undefined) setField('contact_name', String(body.contact_name || '').trim() || null);
      if (body.contact_phone !== undefined) {
        const cp = body.contact_phone ? toPhoneFormat(body.contact_phone) : null;
        setField('contact_phone', cp);
      }
      if (body.systemic_diseases !== undefined) setField('systemic_diseases', String(body.systemic_diseases || '').trim() || null);
      if (body.clinical_conditions !== undefined) setField('clinical_conditions', String(body.clinical_conditions || '').trim() || null);
      if (body.past_operations !== undefined) setField('past_operations', String(body.past_operations || '').trim() || null);
      if (body.card_no !== undefined) {
        const newCardNo = String(body.card_no || '').trim() || null;
        if (newCardNo) {
          const cardDup = await client.query(
            'SELECT id, name, deleted_at FROM members WHERE card_no = $1 AND id != $2',
            [newCardNo, id]
          );
          if (cardDup.rows.length > 0) {
            const cardOwner = cardDup.rows[0];
            const ownerLabel = cardOwner.name + (cardOwner.deleted_at ? ' (eski üye)' : '');
            throw Object.assign(new Error(`Bu kart numarası başka bir üyeye (${ownerLabel}) tanımlı.`), { code: 'CARD_TAKEN' });
          }
        }
        setField('card_no', newCardNo);
      }

      if (body.first_name !== undefined || body.last_name !== undefined) {
        const fn = body.first_name !== undefined ? body.first_name : member.first_name;
        const ln = body.last_name !== undefined ? body.last_name : member.last_name;
        setField('name', `${String(fn || '').trim()} ${String(ln || '').trim()}`.trim());
      }

      setField('deleted_at', null);
      setField('deletion_requested_at', null);
      values.push(id);
      const updateSql = fields.length
        ? `UPDATE members SET ${fields.join(', ')} WHERE id = $${n} RETURNING *`
        : `UPDATE members SET deleted_at = NULL, deletion_requested_at = NULL WHERE id = $1 RETURNING *`;
      const updatedRes = await client.query(updateSql, fields.length ? values : [id]);
      member = updatedRes.rows[0];

      if (member.user_id) {
        await client.query(
          'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [member.user_id]
        );
        await resetMemberPassword(client, member.id);
      } else if (member.email && member.phone) {
        await ensureMemberUserAccount(client, member);
        await resetMemberPassword(client, member.id);
      }

      // Eski üye geri açılınca aktif paketler sonlandırılır; gelecek randevular iptal edilir (MP-28)
      const now = new Date();
      const endDateStr =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0');
      const cutoffStart = new Date(endDateStr + 'T00:00:00').getTime();
      const activePkgs = await client.query(
        `SELECT id FROM member_packages WHERE member_id = $1 AND status = 'active'`,
        [id]
      );
      const endedPackageIds = [];
      for (const pkg of activePkgs.rows) {
        await client.query(
          `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP
           WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL`,
          [pkg.id, cutoffStart]
        );
        await client.query(
          `UPDATE member_packages SET status = 'completed', end_date = $2::date, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [pkg.id, endDateStr]
        );
        endedPackageIds.push(pkg.id);
      }

      await client.query('COMMIT');

      const refreshed = await db.query('SELECT * FROM members WHERE id = $1', [id]);
      const row = refreshed.rows[0] || member;
      await activityLog(req, {
        action: 'member.reactivate',
        entityType: 'member',
        entityId: id,
        details: { member_no: row.member_no, name: row.name, endedPackageIds },
      }).catch(() => {});

      res.json(row);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Member reactivate error:', error);
    res.status(500).json({ error: 'Üye yeniden aktif edilirken hata oluştu' });
  }
});

export default router;
