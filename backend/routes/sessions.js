import express from 'express';
import { body, validationResult, query } from 'express-validator';
import bcrypt from 'bcrypt';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { placeSessionWithRebalance, rebalanceSlotRooms } from '../utils/sessionSlot.js';
import { cancelPackageSessionsAtSlot, resolveMemberPackageId, formatPlacedAtLabel } from '../utils/packageSessions.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { isSessionAttendanceConfirmed } from '../utils/sessionAttendance.js';
import { matchWalkInToSession } from '../utils/facilityAccess.js';
import { resolveLocalDateRangeMs, localDateStrFromTs } from '../utils/staffWorkingHours.js';
import { localTodayDateStr } from '../utils/memberPackageStatus.js';
import { sendExpoPush } from '../utils/pushNotifications.js';

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

// A: reminder sıfırla. B: yeni saat 24h içindeyse üyeye anlık bildirim.
async function handleStartTsChange(sessionId, memberId, newStartTs) {
  await db.query(
    "DELETE FROM session_reminders WHERE session_id = $1 AND reminder_type = '24h'",
    [sessionId]
  ).catch(() => {});

  const nowMs = Date.now();
  const newMs = Number(newStartTs);
  if (!memberId || newMs <= nowMs || newMs - nowMs >= 24 * 3600 * 1000) return;

  const { rows } = await db.query(
    'SELECT u.id AS user_id FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = $1',
    [memberId]
  ).catch(() => ({ rows: [] }));
  if (!rows.length) return;

  const opts = { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' };
  const dateOpts = { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' };
  const timeStr = new Date(newMs).toLocaleTimeString('tr-TR', opts);
  const dateStr = new Date(newMs).toLocaleDateString('tr-TR', dateOpts);
  await sendExpoPush(db, rows[0].user_id, 'Randevu Güncellendi', `Randevunuz ${dateStr} saat ${timeStr}'a alındı.`).catch(() => {});
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
 * Düşürülen seanslar üyenin takviminden habersizce kaybolmasın diye geriye döner; çağıranlar
 * bunu activity log'a yazar ve API yanıtında panele bildirir.
 * @returns {Promise<Array<{ id: number, startTs: number }>>}
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
  if (count <= lessonCount) return [];
  const toRemove = count - lessonCount;
  let lastSessions;
  if (excludeSessionId != null) {
    lastSessions = await db.query(
      'SELECT id, start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) AND id != $2 ORDER BY start_ts DESC LIMIT $3',
      [memberPackageId, excludeSessionId, toRemove]
    );
  } else {
    lastSessions = await db.query(
      'SELECT id, start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) ORDER BY start_ts DESC LIMIT $2',
      [memberPackageId, toRemove]
    );
  }
  const dropped = [];
  for (const row of lastSessions.rows) {
    await db.query('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
    dropped.push({ id: row.id, startTs: Number(row.start_ts) });
  }
  if (dropped.length > 0) {
    console.warn('[trimPackageSessions] paket hakkı aşıldı, son seans(lar) düşürüldü', {
      memberPackageId,
      lessonCount,
      count,
      dropped: dropped.map((d) => new Date(d.startTs).toISOString()),
    });
  }
  return dropped;
}

/** Düşürülen seansları activity log'a yazar; sessiz silme kalmasın. */
async function logTrimmedSessions(req, memberPackageId, dropped) {
  if (!dropped || dropped.length === 0) return;
  await activityLog(req, {
    action: 'session.trim_auto',
    entityType: 'member_package',
    entityId: memberPackageId,
    details: {
      memberPackageId,
      droppedSessionIds: dropped.map((d) => d.id),
      droppedStartTs: dropped.map((d) => d.startTs),
      reason: 'lesson_count_exceeded',
    },
  }).catch(() => {});
}

// Seansları listele (filtreleme ile)
router.get('/', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('staffId').optional().isInt(),
  query('roomId').optional().isInt()
], async (req, res) => {
  try {
    const { staffId, roomId } = req.query;

    // Emniyet freni: aralık verilmezse tüm tablo dönüyordu (37 bin satır / ~21 MB).
    // Mobil uygulamanın yeni seans formu tam olarak bunu yapıyordu ve refetchInterval
    // yüzünden 10 sn'de bir tekrarlıyordu. Eksik uçları varsayılan pencereyle doldur;
    // böylece OTA almamış eski istemciler de hata almadan makul bir yanıt alır.
    // Bilerek LIMIT konmadı: açıkça geniş aralık isteyen çağrılar (yıllık rapor gibi)
    // sessizce kırpılmasın — sessizce eksik veri, yavaş yanıttan kötüdür.
    const DAY_MS = 24 * 60 * 60 * 1000;
    let startDate = req.query.startDate;
    let endDate = req.query.endDate;
    if (!startDate || !endDate) {
      const nowMs = Date.now();
      if (!startDate) startDate = localDateStrFromTs(nowMs - 30 * DAY_MS);
      if (!endDate) endDate = localDateStrFromTs(nowMs + 90 * DAY_MS);
      console.warn('[sessions] tarih aralığı eksik geldi, varsayılan pencere uygulandı', {
        role: req.user.role,
        gelen: { startDate: req.query.startDate ?? null, endDate: req.query.endDate ?? null },
        uygulanan: { startDate, endDate },
      });
    }

    let query = `
      SELECT s.*,
             st.first_name || ' ' || st.last_name as staff_name,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) as member_name,
             (m.deleted_at IS NOT NULL) AS member_deleted,
             r.name as room_name,
             cs.first_name AS confirmer_first_name,
             cs.last_name AS confirmer_last_name,
             cu.role AS confirmer_role
      FROM sessions s
      LEFT JOIN staff st ON s.staff_id = st.id
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN users cu ON cu.id = s.attendance_confirmed_by
      LEFT JOIN staff cs ON cs.user_id = cu.id
      WHERE (s.deleted_at IS NULL)
        AND (s.member_id IS NULL OR (m.id IS NOT NULL AND m.purged_at IS NULL))
    `;
    // Not: soft delete edilmiş üyenin GEÇMİŞ seansları takvimde kalır (gelecek olanlar
    // silme anında deleted_at aldığı için zaten düşer). Kalıcı silinen (purged) üyenin
    // hiçbir seansı görünmez.
    const params = [];
    let paramIndex = 1;

    // Filtreleme
    // startDate/endDate "YYYY-MM-DD" Istanbul takvim günü olarak gelir. Saat dilimi
    // belirtilmeden new Date(...) ile parse edilirse UTC gece yarısı olarak yorumlanır
    // (Istanbul 00:00 değil, Istanbul 03:00) — bu da gün sınırındaki seansları dışarıda
    // bırakabiliyordu. Istanbul sabit +03:00 olduğundan (DST yok) ofseti açıkça veriyoruz.
    if (startDate) {
      const startTs = new Date(startDate + 'T00:00:00.000+03:00').getTime();
      query += ` AND s.start_ts >= $${paramIndex++}`;
      params.push(startTs);
    }
    if (endDate) {
      // Günün sonuna kadar (23:59:59 Istanbul) olacak şekilde start_ts filtrele;
      // s.end_ts ile karşılaştırmak son günkü seansları dışarıda bırakıyordu.
      const endTs = new Date(endDate + 'T23:59:59.999+03:00').getTime();
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
        // Eksik sütun (ör. purged_at migration'ı henüz uygulanmamış): purged/member_deleted
        // koşulları olmadan, silinmiş üyeleri tümüyle gizleyen eski davranışa düş.
        const tail = query
          .split('WHERE (s.deleted_at IS NULL)')[1]
          .replace('AND (s.member_id IS NULL OR (m.id IS NOT NULL AND m.purged_at IS NULL))', '');
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
    ` + tail;
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
  query('types').optional().isString(),
  query('q').optional().isString(),
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

    // types=admin_cancel,member_cancel gibi virgülle ayrılmış tip filtresi
    const ALLOWED_TYPES = new Set(['admin_cancel', 'member_cancel', 'shift_reminder', 'checkin', 'rating']);
    const typeFilter = req.query.types
      ? String(req.query.types).split(',').map(t => t.trim()).filter(t => ALLOWED_TYPES.has(t))
      : [];
    const searchQuery = req.query.q ? String(req.query.q).trim() : '';

    const params = [since, until];
    let cancelFilter = '';

    if (req.user.role === 'staff') {
      const staffResult = await db.query('SELECT id FROM staff WHERE user_id = $1', [req.user.userId]);
      if (staffResult.rows.length === 0) {
        return res.json({ items: [], total: 0, page, perPage, totalPages: 0 });
      }
      const staffId = staffResult.rows[0].id;
      params.push(staffId);
      cancelFilter = ` AND s.staff_id = $${params.length}`;
    }

    // Personel için staff_notifications (shift reminder) UNION'ı
    let shiftReminderSql = '';
    let shiftParams = [...params];
    if (req.user.role === 'staff' || req.user.role === 'admin' || req.user.role === 'manager') {
      // Personel: kendi shift reminder'ları; admin/manager: tüm shift reminder'lar
      const userIdParam = params.length + 1;
      shiftParams = [...params, req.user.userId];
      shiftReminderSql = `
      UNION ALL

      SELECT sn.id,
             CASE sn.type
               WHEN 'cancel' THEN 'member_cancel'
               WHEN 'member_cancel' THEN 'member_cancel'
               WHEN 'rating' THEN 'rating'
               WHEN 'low_rating' THEN 'rating'  -- eski kayıtlar da Puanlar filtresine düşsün
               ELSE 'shift_reminder'
             END AS type,
             EXTRACT(EPOCH FROM sn.created_at AT TIME ZONE 'Europe/Istanbul') * 1000 AS at_ts,
             NULL::int AS staff_id,
             (sn.payload->>'startTs')::bigint AS start_ts,
             sn.payload->>'memberName' AS member_name,
             NULL AS staff_name,
             NULL AS source,
             sn.title AS notif_title,
             sn.body AS notif_body,
             sn.read_at,
             (sn.payload->>'rating')::int AS rating
      FROM staff_notifications sn
      WHERE sn.user_id = $${userIdParam}
        AND sn.created_at AT TIME ZONE 'Europe/Istanbul' > to_timestamp($1 / 1000.0)
        AND sn.created_at AT TIME ZONE 'Europe/Istanbul' <= to_timestamp($2 / 1000.0)
      `;
    }

    const baseSql = `
      SELECT al.id, 'admin_cancel' AS type,
             EXTRACT(EPOCH FROM al.created_at AT TIME ZONE 'Europe/Istanbul') * 1000 AS at_ts,
             s.staff_id, s.start_ts,
             COALESCE(NULLIF(TRIM(m.first_name || ' ' || m.last_name), ''), NULLIF(TRIM(m.name), '')) AS member_name,
             TRIM(st.first_name || ' ' || st.last_name) AS staff_name,
             NULL AS source,
             'Admin Randevu İptali' AS notif_title, NULL AS notif_body, NULL::timestamptz AS read_at,
             NULL::int AS rating
      FROM activity_logs al
      JOIN sessions s ON s.id::text = al.entity_id
      LEFT JOIN members m ON m.id = s.member_id
      LEFT JOIN staff st ON st.id = s.staff_id
      WHERE al.action = 'session.delete'
        AND al.created_at AT TIME ZONE 'Europe/Istanbul' > to_timestamp($1 / 1000.0)
        AND al.created_at AT TIME ZONE 'Europe/Istanbul' <= to_timestamp($2 / 1000.0)${cancelFilter}

      ${shiftReminderSql}
    `;

    // Type + isim arama filtresi SQL koşulu
    let finalParams = [...shiftParams];
    const whereClauses = [];
    if (typeFilter.length > 0) {
      whereClauses.push(`type = ANY($${finalParams.length + 1})`);
      finalParams.push(typeFilter);
    }
    if (searchQuery) {
      const idx = finalParams.length + 1;
      whereClauses.push(`(member_name ILIKE $${idx} OR staff_name ILIKE $${idx})`);
      finalParams.push(`%${searchQuery}%`);
    }
    const typeWhere = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    // Toplam sayı
    let total = 0;
    try {
      const countResult = await db.query(
        `SELECT COUNT(*) AS cnt FROM (${baseSql}) combined${typeWhere}`,
        finalParams
      );
      total = parseInt(countResult.rows[0]?.cnt ?? 0, 10);
    } catch { total = 0; }

    // Sayfalı veri
    const offsetIdx = finalParams.length + 1;
    const limitIdx = finalParams.length + 2;
    const result = await db.query(
      `SELECT * FROM (${baseSql}) combined${typeWhere} ORDER BY at_ts DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...finalParams, offset, perPage]
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
      // shift_reminder / rating özel alanları
      title: r.notif_title || null,
      body: r.notif_body || null,
      readAt: r.read_at || null,
      rating: r.rating != null ? Number(r.rating) : null,
    }));

    res.json({ items, total, page, perPage, totalPages: Math.ceil(total / perPage) });
  } catch (error) {
    if (error.code === '42P01') return res.json({ items: [], total: 0, page: 1, perPage: 20, totalPages: 0 });
    console.error('Bildirimler alınırken hata oluştu:', error);
    res.status(500).json({ error: 'Bildirimler alınırken hata oluştu' });
  }
});

/**
 * Rapor ekranı: yıllık ay × personel seans sayısı.
 * Panel eskiden bir yıllık ham seans listesini indirip istemcide sayıyordu; bu hem
 * MB'larca yük getiriyor hem de takvimin seans state'ini (ve yüklü tarih aralığını)
 * kirletiyordu. Sayım artık burada yapılır, panele yalnızca sayaçlar iner.
 */
router.get('/report-counts', [
  query('year').optional().isInt({ min: 2000, max: 2100 }).toInt(),
], async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    // Türkiye sabit UTC+3 (DST yok) — ay kırılımı panelin yerel saat hesabıyla birebir aynı olsun
    const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
    const startMs = Date.UTC(year, 0, 1) - TZ_OFFSET_MS;
    const endMs = Date.UTC(year + 1, 0, 1) - TZ_OFFSET_MS;

    // Filtreler GET / ile aynı: silinmiş seans yok, kalıcı silinen (purged) üyenin seansı yok.
    const purgedFilter = 'AND (s.member_id IS NULL OR (m.id IS NOT NULL AND m.purged_at IS NULL))';
    const countsSql = `
      SELECT s.staff_id,
             EXTRACT(MONTH FROM to_timestamp(s.start_ts / 1000.0) AT TIME ZONE 'Europe/Istanbul')::int - 1 AS month,
             COUNT(*)::int AS count
      FROM sessions s
      LEFT JOIN members m ON m.id = s.member_id
      WHERE s.deleted_at IS NULL
        ${purgedFilter}
        AND s.start_ts >= $1 AND s.start_ts < $2
      GROUP BY 1, 2`;

    let countRows;
    try {
      countRows = (await db.query(countsSql, [startMs, endMs])).rows;
    } catch (colErr) {
      // purged_at migration'ı henüz uygulanmamışsa koşulsuz çalış (GET / ile aynı geri düşüş)
      if (colErr.code !== '42703') throw colErr;
      countRows = (await db.query(countsSql.replace(purgedFilter, ''), [startMs, endMs])).rows;
    }

    // Silinmiş personelin adı da lazım: raporda "Eski Personeller" sütununda görünüyor.
    const staffIds = [...new Set(countRows.map((r) => r.staff_id).filter((id) => id != null))];
    let staff = [];
    if (staffIds.length > 0) {
      const nameRes = await db.query(
        `SELECT id, NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS name
         FROM staff WHERE id = ANY($1)`,
        [staffIds]
      );
      staff = nameRes.rows.map((r) => ({ id: r.id, name: r.name }));
    }

    res.json({
      year,
      staff,
      counts: countRows.map((r) => ({ staffId: r.staff_id, month: r.month, count: r.count })),
    });
  } catch (error) {
    console.error('Seans sayısı raporu hatası:', error);
    res.status(500).json({ error: 'Rapor alınırken bir hata oluştu' });
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

    // Silinmiş üyeye yeni randevu açılamaz: aksi halde takvimde silinmiş üyenin
    // gelecek randevusu belirir (geçmiş randevular görünür, gelecek olanlar değil).
    const memberRes = await db.query('SELECT deleted_at FROM members WHERE id = $1', [memberId]);
    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: 'Üye bulunamadı' });
    }
    if (memberRes.rows[0].deleted_at != null) {
      return res.status(409).json({ error: 'Bu üye silinmiş. Silinmiş üyeye yeni randevu oluşturulamaz.' });
    }

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
      const dropped = (memberPackageId && !skipTrim)
        ? await trimPackageSessionsIfOver(db, memberPackageId, createdRow?.id)
        : [];
      await logTrimmedSessions(req, memberPackageId, dropped);
      if (createdRow) {
        await activityLog(req, { action: 'session.create', entityType: 'session', entityId: createdRow.id, details: { staffId, memberId, roomId: createdRow.room_id, startTs, endTs } }).catch(() => {});
        matchWalkInToSession(db, createdRow.id).catch(() => {});
      }
      return res.status(201).json({ ...createdRow, droppedSessions: dropped });
    }

    // Oda açıkça belirtildi: tüm odaları kilitle, ekle ve rebalance et.
    // Validasyon geçse de geçmese de rebalance çalışır; bu sayede personel tek odada kalır.
    let client;
    try {
      client = await db.pool.connect();
      await client.query('BEGIN');
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
        return res.status(409).json({ error: rebalanceResult.error || 'Oda ataması geçersiz' });
      }

      const created = await client.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
      await client.query('COMMIT');
      const createdRow = created.rows[0];
      const dropped = (memberPackageId && !skipTrim)
        ? await trimPackageSessionsIfOver(db, memberPackageId, createdRow?.id)
        : [];
      await logTrimmedSessions(req, memberPackageId, dropped);
      if (createdRow) {
        await activityLog(req, { action: 'session.create', entityType: 'session', entityId: createdRow.id, details: { staffId, memberId, roomId: createdRow.room_id, startTs, endTs } }).catch(() => {});
        matchWalkInToSession(db, createdRow.id).catch(() => {});
      }
      return res.status(201).json({ ...createdRow, droppedSessions: dropped });
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

    // Silinmiş üyenin geçmiş seansı takvimde görünür ama salt okunurdur: kayıt olduğu gibi kalmalı
    if (existing.rows[0].member_id) {
      const ownerRes = await db.query('SELECT deleted_at FROM members WHERE id = $1', [existing.rows[0].member_id]);
      if (ownerRes.rows.length > 0 && ownerRes.rows[0].deleted_at != null) {
        return res.status(409).json({ error: 'Bu üye silinmiş. Geçmiş randevu kaydı değiştirilemez.' });
      }
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
      // Validasyon geçsin veya geçmesin her durumda rebalance: personelin tek odada kalması garantilenir.
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
          return res.status(409).json({ error: rebalanceResult.error || 'Oda ataması geçersiz' });
        }

        const result = await client.query('SELECT * FROM sessions WHERE id = $1', [id]);
        await client.query('COMMIT');

        const dropped = (finalMpId && !skipTrim) ? await trimPackageSessionsIfOver(db, finalMpId) : [];
        await logTrimmedSessions(req, finalMpId, dropped);
        const updated = result.rows[0];
        if (updated) {
          await activityLog(req, { action: 'session.update', entityType: 'session', entityId: id, details: { staffId: updated.staff_id, memberId: updated.member_id } }).catch(() => {});
          matchWalkInToSession(db, id).catch(() => {});
          if (updates.startTs !== undefined && Number(updates.startTs) !== Number(current.start_ts)) {
            handleStartTsChange(id, finalMemberId, finalStartTs).catch(() => {});
          }
        }
        return res.json({ message: 'Seans güncellendi', session: updated, droppedSessions: dropped });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    values.push(id);
    const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(query, values);
    const dropped = (finalMpId && !skipTrim) ? await trimPackageSessionsIfOver(db, finalMpId) : [];
    await logTrimmedSessions(req, finalMpId, dropped);
    const updated = result.rows[0];
    if (updated) {
      await activityLog(req, { action: 'session.update', entityType: 'session', entityId: id, details: { staffId: updated.staff_id, memberId: updated.member_id } }).catch(() => {});
      matchWalkInToSession(db, id).catch(() => {});
      if (updates.startTs !== undefined && Number(updates.startTs) !== Number(current.start_ts)) {
        handleStartTsChange(id, finalMemberId, finalStartTs).catch(() => {});
      }
    }
    res.json({ message: 'Seans güncellendi', session: updated, droppedSessions: dropped });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: 'Seans güncellenirken bir hata oluştu' });
  }
});

/**
 * İki seansın personelini (ve odasını) tek işlemde takas eder.
 *
 * Aynı saatteki iki üyeyi tek tek taşımak, ara adımda bir personelin talebi oda
 * kapasitesini aştığı için reddedilir (bkz. rebalanceSlotRooms). Takasta personel
 * başına seans sayısı değişmediğinden kural hiçbir anda ihlal edilmez.
 *
 * Seans satırları korunur: yoklama, puanlama, not, paket bağı ve id'ler aynı kalır.
 * Saat değişmediği için üyeye bildirim gönderilmez ve 24h hatırlatma sıfırlanmaz.
 */
router.post('/swap', [
  body('sessionAId').toInt().isInt(),
  body('sessionBId').toInt().isInt(),
  body('adminPassword').optional().isString(),
], async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Üyeler seans takası yapamaz' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sessionAId, sessionBId, adminPassword } = req.body;
    if (sessionAId === sessionBId) {
      return res.status(400).json({ error: 'Bir seans kendisiyle takas edilemez.' });
    }

    const found = await db.query('SELECT * FROM sessions WHERE id = ANY($1::int[])', [[sessionAId, sessionBId]]);
    const a = found.rows.find((r) => r.id === sessionAId);
    const b = found.rows.find((r) => r.id === sessionBId);
    if (!a || !b || a.deleted_at != null || b.deleted_at != null) {
      return res.status(404).json({ error: 'Seans bulunamadı' });
    }

    // Silinmiş üyenin geçmiş kaydı salt okunurdur (PUT ile aynı kural).
    const memberIds = [a.member_id, b.member_id].filter((x) => x != null);
    if (memberIds.length > 0) {
      const removed = await db.query(
        'SELECT id FROM members WHERE id = ANY($1::int[]) AND deleted_at IS NOT NULL',
        [memberIds]
      );
      if (removed.rows.length > 0) {
        return res.status(409).json({ error: 'Bu üye silinmiş. Geçmiş randevu kaydı değiştirilemez.' });
      }
    }

    // Personel yalnızca kendi seansının taraf olduğu takası yapabilir.
    if (req.user.role === 'staff') {
      const staffResult = await db.query('SELECT id FROM staff WHERE user_id = $1', [req.user.userId]);
      const myStaffId = staffResult.rows[0]?.id ?? null;
      if (myStaffId == null || (Number(a.staff_id) !== myStaffId && Number(b.staff_id) !== myStaffId)) {
        return res.status(403).json({ error: 'Bu seanslar üzerinde takas yetkiniz yok' });
      }
    }

    // Girişi onaylanmış seansta admin şifresi — düzenleme ile aynı kural.
    for (const row of [a, b]) {
      const pwErr = await requireAdminPasswordIfSessionConfirmed(row, adminPassword);
      if (pwErr) {
        return res.status(pwErr.status).json({ error: pwErr.error });
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM rooms ORDER BY id FOR UPDATE');

      // Kilit altında yeniden oku: iki istek aynı anda gelirse doğrulama tazelensin.
      const locked = await client.query(
        'SELECT * FROM sessions WHERE id = ANY($1::int[]) AND deleted_at IS NULL FOR UPDATE',
        [[sessionAId, sessionBId]]
      );
      const la = locked.rows.find((r) => r.id === sessionAId);
      const lb = locked.rows.find((r) => r.id === sessionBId);
      if (!la || !lb) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Seans bulunamadı' });
      }
      if (Number(la.start_ts) !== Number(lb.start_ts) || Number(la.end_ts) !== Number(lb.end_ts)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Takas yalnızca aynı tarih ve saatteki iki seans arasında yapılabilir.' });
      }
      if (la.staff_id == null || lb.staff_id == null || Number(la.staff_id) === Number(lb.staff_id)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Takas için iki seansın personeli farklı olmalı.' });
      }

      await client.query('UPDATE sessions SET staff_id = $1, room_id = $2 WHERE id = $3', [lb.staff_id, lb.room_id, la.id]);
      await client.query('UPDATE sessions SET staff_id = $1, room_id = $2 WHERE id = $3', [la.staff_id, la.room_id, lb.id]);

      // rebalanceSlotRooms BİLEREK çağrılmıyor: iki satır personelini ve odasını
      // karşılıklı değiştirdiği için personel başına seans sayısı, oda doluluğu ve
      // "bir odada tek personel" kuralı zaten korunur. Rebalance çağrılırsa eşit
      // kapasiteli odalarda atama yeniden kurulur ve takasla ilgisi olmayan
      // üyelerin odası da değişir — takasın sessiz kalması bozulur.

      const result = await client.query('SELECT * FROM sessions WHERE id = ANY($1::int[]) ORDER BY id', [[la.id, lb.id]]);
      await client.query('COMMIT');

      await activityLog(req, {
        action: 'session.swap',
        entityType: 'session',
        entityId: la.id,
        details: {
          startTs: Number(la.start_ts),
          sessionAId: la.id,
          sessionBId: lb.id,
          memberAId: la.member_id,
          memberBId: lb.member_id,
          staffAId: la.staff_id,
          staffBId: lb.staff_id,
        },
      }).catch(() => {});

      return res.json({ message: 'Seanslar takas edildi', sessions: result.rows });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Session swap error:', error);
    res.status(500).json({ error: 'Takas sırasında bir hata oluştu' });
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
    // Grup seansında birden çok üye olabildiği için telafi uyarısı hangi üye olduğunu söylemeli.
    let deletedMemberName = '';
    if (row.member_id != null) {
      const nameRes = await db.query(
        `SELECT COALESCE(NULLIF(TRIM(name), ''),
                         NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')) AS name
         FROM members WHERE id = $1`,
        [row.member_id]
      ).catch(() => ({ rows: [] }));
      deletedMemberName = nameRes.rows[0]?.name || '';
    }
    const { cancelledIds, replenished, memberPackageId } = await cancelPackageSessionsAtSlot(db, {
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
        replenishPlacedAt: replenished.added ? formatPlacedAtLabel(replenished.placedAt) : null,
      },
    }).catch(() => {});
    // Admin arayüzü telafinin nereye konduğunu (ya da neden konamadığını) gösterebilsin diye
    // yerleşen slot ve denenip elenen adaylar yanıta eklenir.
    res.json({
      message: replenished.added
        ? `Seans silindi. Telafi ${formatPlacedAtLabel(replenished.placedAt)} olarak paketin sonuna eklendi.`
        : 'Seans silindi',
      replenished: replenished.added,
      replenishedReason: replenished.added ? null : (replenished.reason || null),
      replenishPlaced: replenished.added ? (replenished.placedAt || null) : null,
      replenishCandidates: replenished.added ? null : (replenished.candidates || []),
      packageEndDate: replenished.packageEndDate || null,
      // Admin telafiyi elle yerleştirebilsin diye (POST /member-packages/:id/replenish)
      memberPackageId: memberPackageId ?? null,
      deletedSession: {
        startTs: Number(row.start_ts),
        memberId: row.member_id,
        memberName: deletedMemberName,
        staffId: row.staff_id,
      },
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
