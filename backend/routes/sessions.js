import express from 'express';
import { body, validationResult, query } from 'express-validator';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { validateRoomForSession, placeSessionWithRebalance, rebalanceSlotRooms } from '../utils/sessionSlot.js';
import { cancelPackageSessionsAtSlot, resolveMemberPackageId } from '../utils/packageSessions.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { isSessionAttendanceConfirmed } from '../utils/sessionAttendance.js';
import { matchWalkInToSession } from '../utils/facilityAccess.js';
import { resolveLocalDateRangeMs } from '../utils/staffWorkingHours.js';
import { localTodayDateStr } from '../utils/memberPackageStatus.js';

const router = express.Router();

async function verifyAdminPassword(adminPassword) {
  if (!adminPassword || String(adminPassword).trim() === '') {
    return { ok: false, status: 400, error: 'Admin şifresi gerekli.' };
  }
  const adminResult = await db.query(
    "SELECT password_hash FROM users WHERE role = 'admin' AND is_active = true LIMIT 1"
  );
  if (adminResult.rows.length === 0) {
    return { ok: false, status: 403, error: 'Admin hesabı bulunamadı.' };
  }
  const valid = await bcrypt.compare(String(adminPassword), adminResult.rows[0].password_hash);
  if (!valid) {
    return { ok: false, status: 403, error: 'Admin şifresi hatalı.' };
  }
  return { ok: true };
}

async function requireAdminPasswordIfSessionConfirmed(sessionRow, adminPassword) {
  if (!isSessionAttendanceConfirmed(sessionRow)) return null;
  const pw = await verifyAdminPassword(adminPassword);
  if (!pw.ok) return pw;
  return null;
}

/** Üyenin aynı zaman aralığında (silinmemiş) başka bir randevusu var mı? */
async function memberHasOverlappingSession(memberId, startTs, endTs, excludeSessionId = null) {
  const params = [memberId, startTs, endTs];
  let sql = `SELECT id FROM sessions
    WHERE member_id = $1 AND start_ts < $3 AND end_ts > $2 AND deleted_at IS NULL`;
  if (excludeSessionId != null) {
    sql += ' AND id != $4';
    params.push(excludeSessionId);
  }
  sql += ' LIMIT 1';
  const r = await db.query(sql, params);
  return r.rows.length > 0;
}

// Tüm route'lar için authentication gerekli
router.use(verifyToken);

/**
 * Pakette lesson_count aşıldıysa en son tarihli seans(lar)ı siler. excludeSessionId verilirse o seans hariç tutulur (yeni eklenen silinmesin).
 */
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
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name,
             r.name as room_name,
             cs.first_name AS confirmer_first_name,
             cs.last_name AS confirmer_last_name,
             cu.role AS confirmer_role
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id AND m.deleted_at IS NULL
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN users cu ON cu.id = s.attendance_confirmed_by
      LEFT JOIN staff cs ON cs.user_id = cu.id
      WHERE (s.deleted_at IS NULL)
        AND (s.member_id IS NULL OR m.id IS NOT NULL)
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
      // Günün sonuna kadar (23:59:59 UTC) olacak şekilde start_ts filtrele;
      // s.end_ts ile karşılaştırmak son günkü seansları dışarıda bırakıyordu.
      const endTs = new Date(endDate + 'T23:59:59.999Z').getTime();
      query += ` AND s.start_ts <= $${paramIndex++}`;
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

    // Üye rolü yalnızca kendi seanslarını görebilir
    if (req.user.role === 'member') {
      const memberResult = await db.query(
        'SELECT id FROM members WHERE user_id = $1',
        [req.user.userId]
      );
      if (memberResult.rows.length > 0) {
        query += ` AND s.member_id = $${paramIndex++}`;
        params.push(memberResult.rows[0].id);
      } else {
        query += ' AND 1=0';
      }
    }

    query += ' ORDER BY s.start_ts ASC';

    let result;
    try {
      result = await db.query(query, params);
    } catch (colErr) {
      if (colErr.code === '42703') {
        const fallback = `
      SELECT s.*, 
             st.first_name || ' ' || st.last_name as staff_name,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name,
             r.name as room_name
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id AND m.deleted_at IS NULL
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE (s.deleted_at IS NULL)
        AND (s.member_id IS NULL OR m.id IS NOT NULL)
    ` + query.split('WHERE (s.deleted_at IS NULL)')[1];
        result = await db.query(fallback.replace('WHERE (s.deleted_at IS NULL)', 'WHERE 1=1'), params);
      } else throw colErr;
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: 'Seanslar listelenirken bir hata oluştu' });
  }
});

// Üye iptalleri ve QR ile giriş yapılan bildirimler (personel/admin paneli polling ve bildirim listesi için)
router.get('/notifications', [
  query('since').optional().isInt(),
  query('until').optional().isInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('per_page').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.json({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 });
    }

    const hasSince = req.query.since !== undefined;
    const since = hasSince ? Number(req.query.since) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const until = req.query.until ? Number(req.query.until) : Date.now();
    const perPage = req.query.per_page ? Math.min(100, Number(req.query.per_page)) : 20;
    const page = req.query.page ? Math.max(1, Number(req.query.page)) : 1;
    const offset = (page - 1) * perPage;

    const params = [since, until];
    let cancelFilter = '';
    let checkinFilter = '';
    let walkinFilter = '';

    if (req.user.role === 'staff') {
      const staffResult = await db.query('SELECT id FROM staff WHERE user_id = $1', [req.user.userId]);
      if (staffResult.rows.length === 0) {
        return res.json({ items: [], total: 0, page, perPage, totalPages: 0 });
      }
      const staffId = staffResult.rows[0].id;
      params.push(staffId);
      cancelFilter  = ` AND s.staff_id = $${params.length}`;
      checkinFilter = ` AND s.staff_id = $${params.length}`;
      walkinFilter  = ' AND 1=0';
    }

    const baseSql = `
      SELECT al.id, 'cancel' AS type,
             EXTRACT(EPOCH FROM al.created_at) * 1000 AS at_ts,
             s.staff_id, s.start_ts,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
             TRIM(st.first_name || ' ' || st.last_name) AS staff_name,
             NULL AS source
      FROM activity_logs al
      JOIN sessions s ON s.id::text = al.entity_id
      LEFT JOIN members m ON m.id = s.member_id
      LEFT JOIN staff st ON st.id = s.staff_id
      WHERE al.action = 'session.cancel_by_member'
        AND al.created_at > to_timestamp($1 / 1000.0)
        AND al.created_at <= to_timestamp($2 / 1000.0)${cancelFilter}

      UNION ALL

      SELECT al.id, 'checkin' AS type,
             EXTRACT(EPOCH FROM al.created_at) * 1000 AS at_ts,
             s.staff_id, s.start_ts,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
             TRIM(st.first_name || ' ' || st.last_name) AS staff_name,
             al.details->>'checkInMethod' AS source
      FROM activity_logs al
      JOIN sessions s ON s.id::text = al.entity_id
      LEFT JOIN members m ON m.id = s.member_id
      LEFT JOIN staff st ON st.id = s.staff_id
      WHERE al.action = 'session.check_in_qr'
        AND al.created_at > to_timestamp($1 / 1000.0)
        AND al.created_at <= to_timestamp($2 / 1000.0)${checkinFilter}

      UNION ALL

      SELECT fal.id, 'checkin' AS type,
             EXTRACT(EPOCH FROM fal.accessed_at) * 1000 AS at_ts,
             NULL::int AS staff_id, NULL::bigint AS start_ts,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
             NULL AS staff_name,
             fal.source
      FROM facility_access_logs fal
      LEFT JOIN members m ON m.id = fal.member_id
      WHERE fal.accessed_at > to_timestamp($1 / 1000.0)
        AND fal.accessed_at <= to_timestamp($2 / 1000.0)
        AND fal.member_id IS NOT NULL${walkinFilter}
    `;

    // Toplam sayı
    let total = 0;
    try {
      const countResult = await db.query(`SELECT COUNT(*) AS cnt FROM (${baseSql}) combined`, params);
      total = parseInt(countResult.rows[0]?.cnt ?? 0, 10);
    } catch { total = 0; }

    // Sayfalı veri
    const offsetIdx = params.length + 1;
    const limitIdx = params.length + 2;
    const result = await db.query(
      `SELECT * FROM (${baseSql}) combined ORDER BY at_ts DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, offset, perPage]
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      type: r.type,
      at: Number(r.at_ts),
      staffId: r.staff_id,
      staffName: r.staff_name,
      memberName: r.member_name,
      startTs: r.start_ts ? Number(r.start_ts) : null,
      source: r.source || null,
    }));

    res.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    if (error.code === '42P01') return res.json({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 });
    console.error('Bildirimler alınırken hata oluştu:', error);
    res.status(500).json({ error: 'Bildirimler alınırken hata oluştu' });
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
  body('memberPackageId').optional({ nullable: true }).isInt(),
  body('skipStaffHoursCheck').optional().isBoolean(),
  body('skipTrim').optional().isBoolean(),
], async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Üyeler seans oluşturamaz' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { staffId, memberId, roomId, startTs, endTs, note, memberPackageId } = req.body;
    const skipStaffHoursCheck = !!req.body.skipStaffHoursCheck && ['admin', 'manager'].includes(req.user.role);
    const skipTrim = !!req.body.skipTrim && ['admin', 'manager'].includes(req.user.role);

    if (memberPackageId == null || memberPackageId === '') {
      memberPackageId = await resolveMemberPackageId(db, memberId, startTs);
    }
    if (memberPackageId == null) {
      return res.status(400).json({ error: 'Bu üyenin bu tarihte aktif paketi yok. Sadece aktif paketi olan üyelere seans oluşturulabilir.' });
    }

    if (await memberHasOverlappingSession(memberId, startTs, endTs)) {
      return res.status(409).json({ error: 'Bu üyenin bu saatte zaten bir randevusu var.' });
    }

    // Oda gönderilmediyse: çalışma saati kontrolü + gerekirse oda dengeleme ile yerleştir.
    if (roomId == null || roomId === '') {
      const placed = await placeSessionWithRebalance(db, { staffId, startTs, endTs, memberId, memberPackageId, skipStaffHoursCheck });
      if (!placed.ok) {
        return res.status(409).json({ error: placed.error || 'Bu saatte uygun oda yok (kapasite dolu veya çalışma saati dışında)' });
      }
      const created = await db.query('SELECT * FROM sessions WHERE id = $1', [placed.sessionId]);
      const createdRow = created.rows[0];
      if (memberPackageId && !skipTrim) await trimPackageSessionsIfOver(db, memberPackageId, createdRow?.id);
      if (createdRow) {
        await activityLog(req, { action: 'session.create', entityType: 'session', entityId: createdRow.id, details: { staffId, memberId, roomId: createdRow.room_id, startTs, endTs } }).catch(() => {});
        matchWalkInToSession(db, createdRow.id).catch(() => {});
      }
      return res.status(201).json(createdRow);
    }

    // Oda açıkça belirtildi: kapasite + tek personel kuralı. Transaction + oda kilidi ile race condition önlenir.
    let client;
    try {
      client = await db.pool.connect();
      await client.query('BEGIN');
      const roomRow = await client.query('SELECT id, devices FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
      if (roomRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Oda bulunamadı' });
      }

      const roomValidation = await validateRoomForSession(client, {
        roomId,
        staffId,
        startTs,
        endTs,
      });
      if (!roomValidation.ok) {
        // Direkt atama uygun değil; seansı ekleyip hedef saat dilimini dengeleyerek tekrar dene.
        await client.query('SELECT id FROM rooms ORDER BY id FOR UPDATE');
        const insertResult = await client.query(
          `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [staffId, memberId, roomId, startTs, endTs, note || null, memberPackageId ?? null]
        );
        const sessionId = insertResult.rows[0]?.id;

        const rebalanceResult = await rebalanceSlotRooms(client, { startTs, endTs });
        if (!rebalanceResult.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: rebalanceResult.error || roomValidation.error || 'Oda ataması geçersiz' });
        }

        const created = await client.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
        await client.query('COMMIT');
        const createdRow = created.rows[0];
        if (memberPackageId && !skipTrim) await trimPackageSessionsIfOver(db, memberPackageId, createdRow?.id);
        if (createdRow) {
          await activityLog(req, { action: 'session.create', entityType: 'session', entityId: createdRow.id, details: { staffId, memberId, roomId: createdRow.room_id, startTs, endTs } }).catch(() => {});
          matchWalkInToSession(db, createdRow.id).catch(() => {});
        }
        return res.status(201).json(createdRow);
      }

      const result = await client.query(
        `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [staffId, memberId, roomId, startTs, endTs, note || null, memberPackageId ?? null]
      );
      await client.query('COMMIT');
      const created = result.rows[0];
      if (memberPackageId && !skipTrim) await trimPackageSessionsIfOver(db, memberPackageId, created?.id);
      if (created) {
        await activityLog(req, { action: 'session.create', entityType: 'session', entityId: created.id, details: { staffId, memberId, roomId, startTs, endTs } }).catch(() => {});
        matchWalkInToSession(db, created.id).catch(() => {});
      }
      return res.status(201).json(created);
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      if (client) client.release();
    }
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
  body('memberPackageId').optional({ nullable: true }).isInt(),
  body('adminPassword').optional().isString(),
  body('skipTrim').optional().isBoolean(),
], async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Üyeler seans düzenleyemez' });
    }
    const { id } = req.params;
    const updates = { ...req.body };
    const adminPassword = updates.adminPassword;
    const skipTrim = !!updates.skipTrim;
    delete updates.adminPassword;
    delete updates.skipTrim;

    // Seans var mı ve silinmemiş mi kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0 || existing.rows[0].deleted_at != null) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    const pwErr = await requireAdminPasswordIfSessionConfirmed(existing.rows[0], adminPassword);
    if (pwErr) {
      return res.status(pwErr.status).json({ error: pwErr.error });
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
    const finalStaffId = updates.staffId !== undefined ? updates.staffId : current.staff_id;
    const finalRoomId = updates.roomId !== undefined ? updates.roomId : current.room_id;
    const finalStartTs = updates.startTs !== undefined ? updates.startTs : current.start_ts;
    const finalEndTs = updates.endTs !== undefined ? updates.endTs : current.end_ts;
    if (updates.memberPackageId === undefined) {
      const resolved = await resolveMemberPackageId(db, finalMemberId, finalStartTs);
      // Yeni tarih paket aralığı dışındaysa (örn. paket başlangıcından önce) mevcut paketi koru;
      // böylece seans takvimde ve paket listesinde tutarlı görünür, sayı düşmez.
      updates.memberPackageId = resolved !== null ? resolved : current.member_package_id;
    }

    if (await memberHasOverlappingSession(finalMemberId, finalStartTs, finalEndTs, id)) {
      return res.status(409).json({ error: 'Bu üyenin bu saatte zaten bir randevusu var.' });
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

    const finalMpId = updates.memberPackageId !== undefined ? updates.memberPackageId : current.member_package_id;

    if (finalRoomId != null && finalStaffId != null) {
      const roomValidation = await validateRoomForSession(db, {
        roomId: finalRoomId,
        staffId: finalStaffId,
        startTs: finalStartTs,
        endTs: finalEndTs,
        excludeSessionId: id,
      });
      if (!roomValidation.ok) {
        // Direkt atama uygun değil; hedef saat dilimini dengeleyerek tekrar dene.
        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT id FROM rooms ORDER BY id FOR UPDATE');

          values.push(id);
          const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
          await client.query(query, values);

          const rebalanceResult = await rebalanceSlotRooms(client, { startTs: finalStartTs, endTs: finalEndTs });
          if (!rebalanceResult.ok) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: rebalanceResult.error || roomValidation.error || 'Oda ataması geçersiz' });
          }

          const result = await client.query('SELECT * FROM sessions WHERE id = $1', [id]);
          await client.query('COMMIT');

          if (finalMpId && !skipTrim) await trimPackageSessionsIfOver(db, finalMpId);
          const updated = result.rows[0];
          if (updated) {
            await activityLog(req, { action: 'session.update', entityType: 'session', entityId: id, details: { staffId: updated.staff_id, memberId: updated.member_id } }).catch(() => {});
            matchWalkInToSession(db, id).catch(() => {});
          }
          return res.json({ message: 'Seans güncellendi', session: updated });
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      }
    }

    values.push(id);
    const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, values);
    if (finalMpId && !skipTrim) await trimPackageSessionsIfOver(db, finalMpId);
    const updated = result.rows[0];
    if (updated) {
      await activityLog(req, { action: 'session.update', entityType: 'session', entityId: id, details: { staffId: updated.staff_id, memberId: updated.member_id } }).catch(() => {});
      matchWalkInToSession(db, id).catch(() => {});
    }
    res.json({ message: 'Seans güncellendi', session: updated });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: 'Seans güncellenirken bir hata oluştu' });
  }
});

// Seans sil (soft delete: veritabanında kalır, deleted_at işaretlenir; ileride log için)
router.delete('/:id', [
  body('adminPassword').optional().isString()
], async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Üyeler bu yolla seans silemez. İptal için üye portalını kullanın.' });
    }
    const { id } = req.params;
    const adminPassword = req.body?.adminPassword;

    // Seans var mı ve silinmemiş mi kontrol et
    const existing = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (existing.rows.length === 0 || existing.rows[0].deleted_at != null) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    const pwErr = await requireAdminPasswordIfSessionConfirmed(existing.rows[0], adminPassword);
    if (pwErr) {
      return res.status(pwErr.status).json({ error: pwErr.error });
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

    const row = existing.rows[0];
    const { cancelledIds, replenished } = await cancelPackageSessionsAtSlot(db, {
      memberId: row.member_id,
      startTs: row.start_ts,
      memberPackageId: row.member_package_id,
      deletedBy: req.user.userId ?? null,
    });
    if (cancelledIds.length === 0) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }
    await activityLog(req, {
      action: 'session.delete',
      entityType: 'session',
      entityId: id,
      details: {
        staffId: row.staff_id,
        memberId: row.member_id,
        roomId: row.room_id,
        startTs: row.start_ts,
        endTs: row.end_ts,
        cancelledIds,
        replenished: replenished.added,
        replenishedReason: replenished.added ? null : (replenished.reason || null),
      },
    }).catch(() => {});
    res.json({
      message: replenished.added ? 'Seans silindi, paket sonuna yeni seans eklendi' : 'Seans silindi',
      replenished: replenished.added,
      replenishedReason: replenished.added ? null : (replenished.reason || null),
    });
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
