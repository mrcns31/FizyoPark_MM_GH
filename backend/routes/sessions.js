import express from 'express';
import { body, validationResult, query } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { validateAndPickRoom } from '../utils/sessionSlot.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();

// Tüm route'lar için authentication gerekli
router.use(verifyToken);

/**
 * Üyenin seans tarihi için uygun aktif paket bulur (kullanım süresi içinde, kalan hak var).
 * Önce bitişi yakın olan paket kullanılır (end_date ASC).
 * @returns {Promise<number|null>} member_package_id veya null
 */
/** Seans zamanı için yerel tarih string (YYYY-MM-DD). */
function localDateStr(ts) {
  const d = new Date(Number(ts));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Seans tarihi için uygun aktif paket bulur (tarih paket aralığında).
 * Paket dolu olsa bile bu seansta pakete bağlanır; trimPackageSessionsIfOver fazlayı sondan siler.
 * Böylece iptal edilen bir tarihe tekrar randevu eklendiğinde paket seansları listesinde görünür.
 */
async function resolveMemberPackageId(db, memberId, startTs) {
  const dateStr = localDateStr(startTs);
  const packages = await db.query(
    `SELECT mp.id, mp.package_id, p.lesson_count
     FROM member_packages mp
     JOIN packages p ON p.id = mp.package_id
     WHERE mp.member_id = $1 AND mp.status = 'active'
       AND mp.start_date <= $2 AND mp.end_date >= $2
     ORDER BY mp.end_date ASC`,
    [memberId, dateStr]
  );
  if (packages.rows.length > 0) return packages.rows[0].id;
  return null;
}

const SLOT_DURATION_MS = 60 * 60 * 1000;

/** Pakette lesson_count aşıldıysa en son tarihli seans(lar)ı siler. excludeSessionId verilirse o seans hariç tutulur (yeni eklenen silinmesin). */
async function trimPackageSessionsIfOver(db, memberPackageId, excludeSessionId = null) {
  const pkg = await db.query(
    'SELECT p.lesson_count FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1',
    [memberPackageId]
  );
  const lessonCount = pkg.rows[0]?.lesson_count ?? 0;
  const countRes = await db.query(
    'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
    [memberPackageId]
  );
  const count = countRes.rows[0]?.cnt ?? 0;
  if (count <= lessonCount) return;
  const toRemove = count - lessonCount;
  let lastSessions;
  if (excludeSessionId != null) {
    lastSessions = await db.query(
      'SELECT id FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) AND id != $2 ORDER BY start_ts DESC LIMIT $3',
      [memberPackageId, excludeSessionId, toRemove]
    );
  } else {
    lastSessions = await db.query(
      'SELECT id FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) ORDER BY start_ts DESC LIMIT $2',
      [memberPackageId, toRemove]
    );
  }
  for (const row of lastSessions.rows) {
    await db.query('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
  }
}

/** Veritabanından gelen tarihi (string veya Date) yerel YYYY-MM-DD gününe çevirir. */
function parseLocalDateFromDb(val) {
  if (val instanceof Date) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0, 0);
  }
  const s = String(val || '').trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map((x) => parseInt(x, 10) || 0);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(NaN);
}

/** Paketten bir seans silindiğinde: son kalan seanstan sonraki randevu gününe bir seans ekler. */
async function addNextSessionAfterLastForPackage(db, memberPackageId) {
  try {
    const mp = await db.query(
      `SELECT mp.member_id, mp.start_date, mp.end_date, p.lesson_count
       FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1`,
      [memberPackageId]
    );
    if (mp.rows.length === 0) return;
    const { member_id, start_date, end_date, lesson_count } = mp.rows[0];
    const countRes = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
      [memberPackageId]
    );
    const count = countRes.rows[0]?.cnt ?? 0;
    if (count >= lesson_count) return;
    const lastRes = await db.query(
      'SELECT start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) ORDER BY start_ts DESC LIMIT 1',
      [memberPackageId]
    );
    const end = parseLocalDateFromDb(end_date);
    end.setHours(23, 59, 59, 999);
    if (Number.isNaN(end.getTime())) {
      console.error('addNextSessionAfterLastForPackage: geçersiz end_date', end_date);
      return;
    }
    let startDay;
    if (lastRes.rows.length > 0) {
      const lastDay = new Date(Number(lastRes.rows[0].start_ts));
      startDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1, 0, 0, 0, 0);
    } else {
      startDay = parseLocalDateFromDb(start_date);
      if (Number.isNaN(startDay.getTime())) {
        console.error('addNextSessionAfterLastForPackage: geçersiz start_date', start_date);
        return;
      }
    }
    const slotsRes = await db.query(
      'SELECT day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1',
      [memberPackageId]
    );
    const slots = slotsRes.rows;
    if (slots.length === 0) {
      console.error('addNextSessionAfterLastForPackage: paket için slot tanımlı değil, member_package_id=', memberPackageId);
      return;
    }
    for (let d = new Date(startDay.getTime()); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      for (const slot of slots) {
        if (Number(slot.day_of_week) !== dayOfWeek) continue;
        const timeStr = String(slot.start_time || '08:00');
        const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
        const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
        const startTs = slotStart.getTime();
        const endTs = startTs + SLOT_DURATION_MS;
        const validation = await validateAndPickRoom(db, { staffId: slot.staff_id, startTs, endTs });
        if (!validation.ok) continue;
        const roomId = validation.roomId ?? null;
        await db.query(
          `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
           VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
          [slot.staff_id, member_id, roomId, startTs, endTs, memberPackageId]
        );
        return;
      }
    }
    console.error('addNextSessionAfterLastForPackage: bitiş tarihine kadar uygun gün bulunamadı', { memberPackageId, startDay: startDay.toISOString(), end: end.toISOString() });
  } catch (err) {
    console.error('addNextSessionAfterLastForPackage error:', err);
  }
}

// Seansları listele (filtreleme ile)
router.get('/', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('staffId').optional().isInt(),
  query('roomId').optional().isInt()
], async (req, res) => {
  try {
    const { startDate, endDate, staffId, roomId } = req.query;
    
    let query = `
      SELECT s.*, 
             st.first_name || ' ' || st.last_name as staff_name,
             m.name as member_name,
             r.name as room_name
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE (s.deleted_at IS NULL)
    `;
    const params = [];
    let paramIndex = 1;

    // Filtreleme
    if (startDate) {
      const startTs = new Date(startDate).getTime();
      query += ` AND s.start_ts >= $${paramIndex++}`;
      params.push(startTs);
    }
    if (endDate) {
      const endTs = new Date(endDate).getTime();
      query += ` AND s.end_ts <= $${paramIndex++}`;
      params.push(endTs);
    }
    if (staffId) {
      query += ` AND s.staff_id = $${paramIndex++}`;
      params.push(staffId);
    }
    if (roomId) {
      query += ` AND s.room_id = $${paramIndex++}`;
      params.push(roomId);
    }

    // Staff rolü sadece kendi seanslarını görebilir
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0) {
        query += ` AND s.staff_id = $${paramIndex++}`;
        params.push(staffResult.rows[0].id);
      }
    }

    query += ' ORDER BY s.start_ts ASC';

    let result;
    try {
      result = await db.query(query, params);
    } catch (colErr) {
      if (colErr.code === '42703') {
        const fallback = query.replace('WHERE (s.deleted_at IS NULL)', 'WHERE 1=1');
        result = await db.query(fallback, params);
      } else throw colErr;
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: 'Seanslar listelenirken bir hata oluştu' });
  }
});

// Yeni seans oluştur (toInt ile string sayılar kabul edilir)
router.post('/', [
  body('staffId').toInt().isInt().withMessage('Personel ID gerekli'),
  body('memberId').toInt().isInt().withMessage('Üye ID gerekli'),
  body('roomId').optional({ values: 'null' }).toInt().isInt(),
  body('startTs').toInt().isInt().withMessage('Başlangıç zamanı gerekli'),
  body('endTs').toInt().isInt().withMessage('Bitiş zamanı gerekli'),
  body('note').optional({ values: 'null' }).custom((v) => v == null || typeof v === 'string').withMessage('Not metin olmalı'),
  body('memberPackageId').optional({ nullable: true }).isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { staffId, memberId, roomId, startTs, endTs, note, memberPackageId } = req.body;

    if (memberPackageId == null || memberPackageId === '') {
      memberPackageId = await resolveMemberPackageId(db, memberId, startTs);
    }
    if (memberPackageId == null) {
      return res.status(400).json({ error: 'Bu üyenin bu tarihte aktif paketi yok. Sadece aktif paketi olan üyelere seans oluşturulabilir.' });
    }

    // Oda gönderilmediyse kapasitesi uygun bir oda seç; yoksa ekleme (4. kişi engeli).
    if (roomId == null || roomId === '') {
      const validation = await validateAndPickRoom(db, { staffId, startTs, endTs });
      if (!validation.ok) {
        return res.status(409).json({ error: 'Bu saatte uygun oda yok (kapasite dolu veya çalışma saati dışında)' });
      }
      roomId = validation.roomId;
    }

    // Oda kapasitesi: odadaki alet sayısı kadar seans. Transaction + oda kilidi ile race condition önlenir.
    // roomId 0 dahil tüm geçerli oda id'leri için kontrol (if (roomId) 0'da atlıyordu)
    if (roomId != null && roomId !== '') {
      let client;
      try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const roomRow = await client.query('SELECT id, devices FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
        if (roomRow.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Oda bulunamadı' });
        }
        const devices = Math.max(1, parseInt(roomRow.rows[0].devices, 10) || 0);
        const countResult = await client.query(
          `SELECT COUNT(*)::int as cnt FROM sessions s
           WHERE s.room_id = $1 AND s.start_ts < $3 AND s.end_ts > $2 AND (s.deleted_at IS NULL)`,
          [roomId, startTs, endTs]
        );
        const currentSessions = parseInt(countResult.rows[0]?.cnt, 10) || 0;
        if (currentSessions >= devices) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Oda kapasitesi dolu' });
        }
        const result = await client.query(
          `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [staffId, memberId, roomId, startTs, endTs, note || null, memberPackageId ?? null]
        );
        await client.query('COMMIT');
        const created = result.rows[0];
        if (memberPackageId) await trimPackageSessionsIfOver(db, memberPackageId, created?.id);
        if (created) await activityLog(req, { action: 'session.create', entityType: 'session', entityId: created.id, details: { staffId, memberId, roomId, startTs, endTs } }).catch(() => {});
        return res.status(201).json(created);
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        if (client) client.release();
      }
    }

    // Sadece roomId gerçekten yoksa (validateAndPickRoom sonrası da set edilir, buraya düşmemeli)
    return res.status(400).json({ error: 'Oda seçilemedi. Bu saatte uygun oda yok (kapasite dolu veya çalışma saati dışında).' });
  } catch (error) {
    console.error('Session create error:', error);
    res.status(500).json({ error: 'Seans oluşturulurken bir hata oluştu' });
  }
});

// Seans güncelle
router.put('/:id', [
  body('staffId').optional().isInt(),
  body('memberId').optional().isInt(),
  body('roomId').optional().isInt(),
  body('startTs').optional().isInt(),
  body('endTs').optional().isInt(),
  body('note').optional().isString(),
  body('memberPackageId').optional({ nullable: true }).isInt()
], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Seans var mı ve silinmemiş mi kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0 || existing.rows[0].deleted_at != null) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    // Yetki kontrolü (staff sadece kendi seanslarını düzenleyebilir)
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0 && 
          existing.rows[0].staff_id !== staffResult.rows[0].id) {
        return res.status(403).json({ error: 'Bu seansı düzenleme yetkiniz yok' });
      }
    }

    const current = existing.rows[0];
    const finalMemberId = updates.memberId !== undefined ? updates.memberId : current.member_id;
    const finalStartTs = updates.startTs !== undefined ? updates.startTs : current.start_ts;
    if (updates.memberPackageId === undefined) {
      const resolved = await resolveMemberPackageId(db, finalMemberId, finalStartTs);
      // Yeni tarih paket aralığı dışındaysa (örn. paket başlangıcından önce) mevcut paketi koru;
      // böylece seans takvimde ve paket listesinde tutarlı görünür, sayı düşmez.
      updates.memberPackageId = resolved !== null ? resolved : current.member_package_id;
    }

    // Güncelleme alanlarını oluştur
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (['staffId', 'memberId', 'roomId', 'startTs', 'endTs', 'note', 'memberPackageId'].includes(key)) {
        const dbKey = key === 'staffId' ? 'staff_id' : 
                     key === 'memberId' ? 'member_id' : 
                     key === 'roomId' ? 'room_id' : 
                     key === 'startTs' ? 'start_ts' : 
                     key === 'endTs' ? 'end_ts' : 
                     key === 'memberPackageId' ? 'member_package_id' : key;
        updateFields.push(`${dbKey} = $${paramIndex++}`);
        const val = updates[key];
        values.push(val === null || val === undefined ? null : val);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    values.push(id);
    const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, values);
    const finalMpId = updates.memberPackageId !== undefined ? updates.memberPackageId : current.member_package_id;
    if (finalMpId) await trimPackageSessionsIfOver(db, finalMpId);
    const updated = result.rows[0];
    if (updated) await activityLog(req, { action: 'session.update', entityType: 'session', entityId: id, details: { staffId: updated.staff_id, memberId: updated.member_id } }).catch(() => {});
    res.json({ message: 'Seans güncellendi', session: updated });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: 'Seans güncellenirken bir hata oluştu' });
  }
});

// Seans sil (soft delete: veritabanında kalır, deleted_at işaretlenir; ileride log için)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Seans var mı ve silinmemiş mi kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0 || existing.rows[0].deleted_at != null) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role === 'staff') {
      const staffResult = await db.query(
        'SELECT id FROM staff WHERE user_id = $1',
        [req.user.userId]
      );
      if (staffResult.rows.length > 0 && 
          existing.rows[0].staff_id !== staffResult.rows[0].id) {
        return res.status(403).json({ error: 'Bu seansı silme yetkiniz yok' });
      }
    }

    let memberPackageId = existing.rows[0].member_package_id;
    const memberId = existing.rows[0].member_id;
    const startTs = existing.rows[0].start_ts;
    await db.query(
      'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $2 WHERE id = $1',
      [id, req.user.userId ?? null]
    );
    if (memberPackageId == null && memberId != null && startTs != null) {
      memberPackageId = await resolveMemberPackageId(db, memberId, startTs);
    }
    if (memberPackageId != null) {
      await addNextSessionAfterLastForPackage(db, memberPackageId);
    }
    const row = existing.rows[0];
    await activityLog(req, {
      action: 'session.delete',
      entityType: 'session',
      entityId: id,
      details: {
        staffId: row.staff_id,
        memberId: row.member_id,
        roomId: row.room_id,
        startTs: row.start_ts,
        endTs: row.end_ts
      }
    }).catch(() => {});
    res.json({ message: 'Seans silindi' });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: 'Seans silinirken bir hata oluştu' });
  }
});

// Grup seansları sil (personel bazlı)
router.delete('/group/bulk', [
  body('staffId').isInt(),
  body('startTs').isInt(),
  body('endTs').isInt(),
  body('roomId').optional().isInt()
], async (req, res) => {
  try {
    const { staffId, startTs, endTs, roomId } = req.body;

    const params = [staffId, startTs, endTs];
    if (roomId != null) params.push(roomId);
    params.push(req.user.userId ?? null);
    const query = roomId != null
      ? `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $5 WHERE staff_id = $1 AND start_ts = $2 AND end_ts = $3 AND room_id = $4`
      : `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $4 WHERE staff_id = $1 AND start_ts = $2 AND end_ts = $3`;

    const result = await db.query(query, params);
    await activityLog(req, { action: 'session.delete_bulk', entityType: 'session', details: { staffId, startTs, endTs, roomId: roomId ?? null, deletedCount: result.rowCount ?? 0 } }).catch(() => {});
    res.json({ 
      message: 'Grup seansları silindi',
      deletedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Seanslar silinirken bir hata oluştu' });
  }
});

export default router;
