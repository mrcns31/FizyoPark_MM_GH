import express from 'express';
import { body, validationResult, query } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { validateAndPickRoom, validateRoomForSession, placeSessionWithRebalance } from '../utils/sessionSlot.js';
import { log as activityLog } from '../utils/activityLogger.js';
import { ATTENDANCE_JOIN_SQL } from '../utils/sessionAttendance.js';
import { loadStaffMap, sessionToDto } from '../utils/memberPackageDto.js';
import { fulfillPendingPackageRequestsForMember } from './package-requests.js';
import { localDateStrFromTs } from '../utils/staffWorkingHours.js';
import { autoCompletePackageIfExhausted } from '../utils/packageSessionCounts.js';

const router = express.Router();
router.use(verifyToken);

router.use((req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
  }
  next();
});

const SLOT_DURATION_MS = 60 * 60 * 1000; // 1 saat

/**
 * Seçilen tarih aralığı ve slot'lara (gün/saat/personel) göre [startDate, endDate] içinde
 * oluşturulabilecek randevu günü sayısını döner (her gün en fazla bir kez sayılır).
 */
function countPossibleSessionsInRange(startDate, endDate, slots) {
  if (!slots || slots.length === 0) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    for (const slot of slots) {
      if (Number(slot.day_of_week) !== dayOfWeek) continue;
      count++;
      break;
    }
  }
  return count;
}

/** lesson_count kadar seans sığacak bitiş tarihini (YYYY-MM-DD) hesaplar. */
export function computeEndDateForLessonCount(startDate, slots, lessonCount) {
  if (!slots?.length || !lessonCount || lessonCount < 1) {
    return String(startDate || '').slice(0, 10);
  }
  const start = new Date(String(startDate).slice(0, 10) + 'T00:00:00');
  let count = 0;
  let lastDateStr = String(startDate).slice(0, 10);
  const maxDays = Math.max(365 * 3, lessonCount * 14);
  for (let i = 0; count < lessonCount && i < maxDays; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    for (const slot of slots) {
      if (Number(slot.day_of_week) !== dayOfWeek) continue;
      count += 1;
      lastDateStr = localDateStrFromTs(d.getTime());
      break;
    }
  }
  return lastDateStr;
}

async function backfillMissingPackageSessions(db, mpId, memberId, startDate, endDate, slots, lessonCount) {
  const existingRes = await db.query(
    'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
    [mpId]
  );
  const existingCount = existingRes.rows[0]?.cnt ?? 0;
  const maxToCreate = Math.max(0, lessonCount - existingCount);
  if (maxToCreate <= 0) return { conflicts: [], sessionsCreated: 0 };

  let effectiveEndDate = String(endDate).slice(0, 10);
  const neededEnd = computeEndDateForLessonCount(startDate, slots, lessonCount);
  if (neededEnd > effectiveEndDate) {
    effectiveEndDate = neededEnd;
    await db.query('UPDATE member_packages SET end_date = $1 WHERE id = $2', [effectiveEndDate, mpId]);
  }

  const lastRes = await db.query(
    `SELECT start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)
     ORDER BY start_ts DESC LIMIT 1`,
    [mpId]
  );
  let genStart = String(startDate).slice(0, 10);
  if (lastRes.rows[0]?.start_ts) {
    const lastDate = new Date(Number(lastRes.rows[0].start_ts));
    lastDate.setDate(lastDate.getDate() + 1);
    genStart = localDateStrFromTs(lastDate.getTime());
  }
  if (genStart > effectiveEndDate) return { conflicts: [], sessionsCreated: 0 };

  const possible = countPossibleSessionsInRange(genStart, effectiveEndDate, slots);
  const toCreate = Math.min(maxToCreate, possible);
  if (toCreate <= 0) return { conflicts: [], sessionsCreated: 0 };

  return generateSessionsForMemberPackage(db, mpId, memberId, genStart, effectiveEndDate, slots, toCreate, {
    excludeMemberPackageId: mpId,
  });
}

const DAY_NAMES = ['Pazar', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const PACKAGE_CONFLICT_ERROR =
  'Seçilen gün/saat/personel için müsaitlik yok. Lütfen ilgili satırları düzenleyip tekrar kaydedin.';

/** Paket slot'larına göre oluşturulacak seans planını (henüz DB'ye yazılmadan) üretir.
 *  Tüm tarih/saat işlemleri UTC metotlarıyla yapılır (+03:00 ofsetiyle) — sunucu TZ'den bağımsız.
 */
function buildPackageSessionInsertPlan(startDate, endDate, slots, limit, { memberId, mpId = null }) {
  const inserts = [];
  if (!slots?.length || !limit || limit <= 0) return inserts;

  // Tarihleri YYYY-MM-DD parçalarına ayır, UTC gece yarısı olarak başlat (TZ bağımsız)
  const [sy, sm, sd] = String(startDate).slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = String(endDate).slice(0, 10).split('-').map(Number);
  const endUtcMs = Date.UTC(ey, em - 1, ed);

  let curUtcMs = Date.UTC(sy, sm - 1, sd);
  while (inserts.length < limit && curUtcMs <= endUtcMs) {
    const curDate = new Date(curUtcMs);
    const year     = curDate.getUTCFullYear();
    const month    = curDate.getUTCMonth();
    const day      = curDate.getUTCDate();
    const dayOfWeek = curDate.getUTCDay();
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    for (const slot of slots) {
      if (inserts.length >= limit) break;
      if (Number(slot.day_of_week) !== dayOfWeek) continue;
      const [h, m] = (slot.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
      // Saati Türkiye yerel saati (+03:00) olarak oluştur
      const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`);
      const startTs = slotStart.getTime();
      inserts.push({
        staff_id: slot.staff_id,
        member_id: memberId,
        start_ts: startTs,
        end_ts: startTs + SLOT_DURATION_MS,
        member_package_id: mpId,
        start_time: slot.start_time,
        dateStr,
        day_of_week: dayOfWeek,
      });
    }
    curUtcMs += 24 * 60 * 60 * 1000; // bir sonraki gün
  }
  return inserts;
}

/** Planlanan seansların tamamı için müsaitlik kontrolü; çakışma varsa liste döner. */
async function validatePackageSessionInserts(db, inserts, { excludeMemberPackageId } = {}) {
  const conflicts = [];
  const pendingByRoom = new Map();
  for (const row of inserts) {
    const validation = await validateAndPickRoom(db, {
      staffId: row.staff_id,
      startTs: row.start_ts,
      endTs: row.end_ts,
    });
    if (!validation.ok) {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message: validation.error || 'Bu saatte oda müsait değil (kapasite dolu veya çalışma saati dışında)',
      });
      continue;
    }
    const roomId = validation.roomId ?? null;
    if (roomId == null) {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message: 'Bu saatte uygun oda bulunamadı',
      });
      continue;
    }
    let countSql = `
      SELECT COUNT(*)::int AS cnt FROM sessions
      WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2 AND (deleted_at IS NULL)
    `;
    const countParams = [roomId, row.start_ts, row.end_ts];
    if (excludeMemberPackageId != null) {
      countParams.push(excludeMemberPackageId);
      countSql += ` AND (member_package_id IS NULL OR member_package_id != $${countParams.length})`;
    }
    const countResult = await db.query(countSql, countParams);
    const roomKey = `${roomId}:${row.start_ts}:${row.end_ts}`;
    const pending = pendingByRoom.get(roomKey) || 0;
    const currentSessions = (parseInt(countResult.rows[0]?.cnt, 10) || 0) + pending;
    const roomRow = await db.query('SELECT devices FROM rooms WHERE id = $1', [roomId]);
    const devices = Math.max(1, parseInt(roomRow.rows[0]?.devices, 10) || 0);
    if (currentSessions >= devices) {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message: 'Bu saatte oda müsait değil (kapasite dolu)',
      });
      continue;
    }
    const roomValidation = await validateRoomForSession(db, {
      roomId,
      staffId: row.staff_id,
      startTs: row.start_ts,
      endTs: row.end_ts,
    });
    if (!roomValidation.ok) {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message: roomValidation.error || 'Bu saatte oda müsait değil',
      });
      continue;
    }
    pendingByRoom.set(roomKey, pending + 1);
  }
  return conflicts;
}

async function enrichConflictsWithStaff(db, conflicts) {
  if (!conflicts?.length) return conflicts || [];
  const staffIds = [...new Set(conflicts.map((c) => c.staff_id).filter((id) => id != null))];
  if (!staffIds.length) return conflicts;
  const staffRes = await db.query(
    `SELECT id, TRIM(first_name || ' ' || last_name) AS name FROM staff WHERE id = ANY($1::int[])`,
    [staffIds]
  );
  const nameById = Object.fromEntries(staffRes.rows.map((r) => [r.id, r.name]));
  return conflicts.map((c) => ({
    ...c,
    staff_name: nameById[c.staff_id] || null,
  }));
}

async function restoreMemberPackageAfterFailedGeneration(db, mpId, oldSlots, futureSessionIds, slotsWereChanged) {
  if (futureSessionIds?.length) {
    await db.query('UPDATE sessions SET deleted_at = NULL WHERE id = ANY($1::int[])', [futureSessionIds]).catch(() => {});
  }
  if (slotsWereChanged && oldSlots?.length) {
    await db.query('DELETE FROM member_package_slots WHERE member_package_id = $1', [mpId]);
    for (const s of oldSlots) {
      await db.query(
        `INSERT INTO member_package_slots (member_package_id, day_of_week, start_time, staff_id)
         VALUES ($1, $2, $3, $4)`,
        [mpId, s.day_of_week, String(s.start_time).trim(), s.staff_id]
      );
    }
  }
}

async function respondPackageSessionConflicts(res, db, conflicts) {
  return res.status(409).json({
    error: PACKAGE_CONFLICT_ERROR,
    conflicts: await enrichConflictsWithStaff(db, conflicts),
  });
}

/** İki slot listesinin (day_of_week, start_time, staff_id) kümesi olarak aynı olup olmadığını döner. */
function slotsEqual(slotsA, slotsB) {
  const key = (s) => `${s.day_of_week}-${String(s.start_time || '').trim()}-${s.staff_id}`;
  if (!slotsA && !slotsB) return true;
  if (!slotsA || !slotsB || slotsA.length !== slotsB.length) return false;
  const setA = new Set(slotsA.map(key));
  const setB = new Set(slotsB.map(key));
  for (const k of setA) if (!setB.has(k)) return false;
  return true;
}

/**
 * Paket slot'larına göre start_date..end_date aralığında en fazla lesson_count (veya maxSessions) kadar seans oluşturur.
 * Herhangi bir çakışma varsa hiçbir seans eklenmez (all-or-nothing).
 * @param {number} [maxSessions] - En fazla bu kadar seans oluştur (güncellemede geçmiş seanslar korunuyorsa lesson_count - kept)
 * @param {{ excludeMemberPackageId?: number }} [options]
 * @returns {{ conflicts: Array<{ date: string, day_name: string, start_time: string, staff_id: number, message: string }> }}
 */
export async function generateSessionsForMemberPackage(db, mpId, memberId, startDate, endDate, slots, maxSessions = null, options = {}) {
  const conflicts = [];
  let sessionsCreated = 0;
  if (!slots || slots.length === 0) return { conflicts, sessionsCreated };
  const pkg = await db.query(
    'SELECT p.lesson_count FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1',
    [mpId]
  );
  const lessonCount = pkg.rows[0]?.lesson_count ?? 0;
  if (lessonCount <= 0) return { conflicts, sessionsCreated };
  const limit = maxSessions != null ? Math.max(0, Number(maxSessions)) : lessonCount;
  if (limit <= 0) return { conflicts, sessionsCreated };

  const inserts = buildPackageSessionInsertPlan(startDate, endDate, slots, limit, { memberId, mpId });

  // Pakete ait silinmemiş mevcut seanslar varsa aynı timestamp için tekrar seans oluşturma
  let filteredInserts = inserts;
  if (mpId) {
    const existingTsRes = await db.query(
      'SELECT start_ts FROM sessions WHERE member_package_id = $1 AND deleted_at IS NULL',
      [mpId]
    );
    if (existingTsRes.rows.length > 0) {
      const existingTsSet = new Set(existingTsRes.rows.map((r) => Number(r.start_ts)));
      filteredInserts = inserts.filter((row) => !existingTsSet.has(Number(row.start_ts)));
    }
  }

  const validationConflicts = await validatePackageSessionInserts(db, filteredInserts, {
    excludeMemberPackageId: options.excludeMemberPackageId,
  });
  if (validationConflicts.length > 0) {
    return { conflicts: validationConflicts, sessionsCreated: 0 };
  }

  const insertedSessionIds = [];
  for (const row of filteredInserts) {
    const pushConflict = (message) => {
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message,
      });
    };
    const placed = await placeSessionWithRebalance(db, {
      staffId: row.staff_id,
      startTs: row.start_ts,
      endTs: row.end_ts,
      memberId: row.member_id,
      memberPackageId: row.member_package_id,
    });
    if (!placed.ok) {
      pushConflict(placed.error || 'Bu saatte oda müsait değil');
      break;
    }
    insertedSessionIds.push(placed.sessionId);
    sessionsCreated += 1;
  }
  if (conflicts.length > 0 && insertedSessionIds.length > 0) {
    await db.query('DELETE FROM sessions WHERE id = ANY($1::int[])', [insertedSessionIds]).catch(() => {});
    sessionsCreated = 0;
  }
  return { conflicts, sessionsCreated };
}

// Üyeye ait paket atamalarını listele
router.get('/', [
  query('memberId').optional().isInt(),
], async (req, res) => {
  try {
    const { memberId } = req.query;

    // 2-saat kuralı ile yanan seansları da sayarak bitmiş paketleri otomatik tamamla
    const completedIds = await autoCompletePackageIfExhausted(db);
    if (completedIds.length > 0) {
      console.log('[member-packages GET] autoComplete → tamamlanan paketler:', completedIds);
    }

    let sql = `
      SELECT mp.*, p.name as package_name, p.lesson_count, p.month_overrun,
             COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') as member_name, m.member_no,
             GREATEST(0, p.lesson_count - (
               SELECT COUNT(*) FROM sessions s
               WHERE s.member_package_id = mp.id
                 AND s.deleted_at IS NULL
                 AND (
                   s.checked_in_at IS NOT NULL
                   OR s.attendance_outcome = 'no_show'
                   OR (s.end_ts < EXTRACT(EPOCH FROM NOW()) * 1000
                       AND EXTRACT(EPOCH FROM NOW()) * 1000 >= s.start_ts - 7200000)
                 )
             )) AS remaining_sessions,
             COALESCE((
               SELECT JSON_AGG(sl ORDER BY sl.day_of_week)
               FROM member_package_slots sl
               WHERE sl.member_package_id = mp.id
             ), '[]'::json) AS slots
      FROM member_packages mp
      JOIN packages p ON p.id = mp.package_id
      JOIN members m ON m.id = mp.member_id AND (m.deleted_at IS NULL)
      WHERE 1=1
    `;
    const params = [];
    if (memberId) {
      params.push(memberId);
      sql += ` AND mp.member_id = $${params.length}`;
    }
    sql += ' ORDER BY mp.start_date DESC';

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Member packages list error:', error);
    res.status(500).json({ error: 'Üye paketleri listelenirken hata oluştu' });
  }
});

// Tek bir üye paket ataması getir (slot'lar dahil)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mpRes = await db.query(
      `SELECT mp.*, p.name as package_name, p.lesson_count
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       WHERE mp.id = $1`,
      [id]
    );
    if (mpRes.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    }
    const slotsRes = await db.query(
      'SELECT id, day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1 ORDER BY day_of_week',
      [id]
    );
    const row = mpRes.rows[0];
    row.slots = slotsRes.rows;
    res.json(row);
  } catch (error) {
    console.error('Member package get error:', error);
    res.status(500).json({ error: 'Üye paketi alınırken hata oluştu' });
  }
});

// Paket yükseltme/düşürme önizlemesi: geçmiş/gelecek seans sayıları ve işlemin uygunluğunu döner.
router.get('/:id/upgrade-preview', async (req, res) => {
  try {
    const { id } = req.params;
    const newPackageId = req.query.new_package_id;
    if (!newPackageId) return res.status(400).json({ error: 'new_package_id gerekli' });

    const mpRes = await db.query('SELECT * FROM member_packages WHERE id = $1', [id]);
    if (!mpRes.rows.length) return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    const mp = mpRes.rows[0];

    const [oldPkgRes, newPkgRes] = await Promise.all([
      db.query('SELECT lesson_count, name FROM packages WHERE id = $1', [mp.package_id]),
      db.query('SELECT lesson_count, name FROM packages WHERE id = $1', [newPackageId]),
    ]);
    if (!oldPkgRes.rows.length || !newPkgRes.rows.length) {
      return res.status(404).json({ error: 'Paket bulunamadı' });
    }

    const oldLessonCount = Number(oldPkgRes.rows[0].lesson_count);
    const newLessonCount = Number(newPkgRes.rows[0].lesson_count);
    const nowMs = Date.now();

    const [pastRes, futureRes] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts < $2 AND deleted_at IS NULL', [id, nowMs]),
      db.query('SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL', [id, nowMs]),
    ]);

    const pastCount = pastRes.rows[0]?.cnt ?? 0;
    const futureCount = futureRes.rows[0]?.cnt ?? 0;
    const action = newLessonCount > oldLessonCount ? 'upgrade' : newLessonCount < oldLessonCount ? 'downgrade' : 'same';

    let canProceed = true;
    let blockReason = null;
    if (action === 'downgrade' && pastCount >= newLessonCount) {
      canProceed = false;
      blockReason = `Bu üye ${pastCount} seans kullanmış. En az ${pastCount + 1} seans içeren bir pakete geçiş yapılabilir.`;
    }

    res.json({
      oldLessonCount,
      newLessonCount,
      pastCount,
      futureCount,
      action,
      diff: Math.abs(newLessonCount - oldLessonCount),
      canProceed,
      blockReason,
    });
  } catch (error) {
    console.error('Upgrade preview error:', error);
    res.status(500).json({ error: 'Önizleme alınamadı' });
  }
});

// Uygunluk kontrolü: verilen slot'lar ve tarih aralığında çakışma var mı?
// Personel o saatte dolu olsa bile oda müsaitse çakışma sayılmaz; oda müsait değilse o gün için uyarı.
router.post('/check-availability', [
  body('member_id').isInt(),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('slots').isArray(),
  body('slots.*.day_of_week').isInt({ min: 0, max: 6 }),
  body('slots.*.start_time').trim().notEmpty(),
  body('slots.*.staff_id').isInt(),
  body('exclude_member_package_id').optional().isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { member_id, start_date, end_date, slots, exclude_member_package_id } = req.body;
    const start = new Date(start_date);
    const end = new Date(end_date);
    const conflicts = [];
    const dayNames = ['Pazar', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    // Sebep kodunu Türkçe açıklamaya çevirir
    const reasonLabel = (reason) => {
      switch (reason) {
        case 'kapalı_gün': return 'tesis kapalı';
        case 'çalışma_saati_dışı': return 'tesisin çalışma saati dışı';
        case 'personel_kapalı_gün': return 'personelin çalışmadığı gün';
        case 'personel_çalışma_saati_dışı': return 'personelin çalışma saati dışı';
        case 'oda_kapasitesi_dolu': return 'oda kapasitesi dolu';
        case 'oda_yok': return 'tanımlı oda yok';
        default: return 'müsait değil';
      }
    };

    // Tarih formatlama (DD.MM.YYYY) — Istanbul tarihi üzerinden
    const fmtDateStr = (istDateStr) => {
      const [yyyy, mm, dd] = istDateStr.split('-');
      return `${dd}.${mm}.${yyyy}`;
    };

    // Personel adını cache'le (staff_id → name)
    const staffNameCache = {};
    const getStaffName = async (staffId) => {
      if (staffNameCache[staffId]) return staffNameCache[staffId];
      const r = await db.query('SELECT first_name || \' \' || last_name AS name FROM staff WHERE id = $1', [staffId]);
      staffNameCache[staffId] = r.rows[0]?.name || `Personel #${staffId}`;
      return staffNameCache[staffId];
    };

    // UTC+3 (Istanbul) sabit offset — sunucu TZ'sinden bağımsız timestamp üretimi için
    const CA_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

    for (const slot of slots) {
      const { day_of_week, start_time, staff_id } = slot;
      const [h, m] = (start_time + '').split(':').map(Number);
      const hStr = String(h).padStart(2, '0');
      const mStr = String(m || 0).padStart(2, '0');
      let d = new Date(start);
      while (d <= end) {
        // Günü Istanbul saatine göre hesapla (sunucu TZ'sinden bağımsız)
        const dInTR = new Date(d.getTime() + CA_TZ_OFFSET_MS);
        const istDateStr = dInTR.toISOString().slice(0, 10); // "YYYY-MM-DD" Istanbul
        if (dInTR.getUTCDay() === day_of_week) {
          // Timestamp'i +03:00 ile oluştur — sunucu TZ ne olursa olsun 18:00 İstanbul = 15:00 UTC
          const startTs = new Date(`${istDateStr}T${hStr}:${mStr}:00+03:00`).getTime();
          const endTs = startTs + SLOT_DURATION_MS;

          // Grup seans destekleniyor: personelin başka seansı olması çakışma değil.
          // Sadece oda kapasitesi ve çalışma saati kısıtı kontrol edilir.
          const validation = await validateAndPickRoom(db, { staffId: staff_id, startTs, endTs });
          if (!validation.ok) {
            const staffName = await getStaffName(staff_id);
            const neden = reasonLabel(validation.reason);
            conflicts.push({
              date: istDateStr,
              day_name: dayNames[day_of_week],
              start_time,
              staff_id,
              staff_name: staffName,
              reason: validation.reason || 'müsait_değil',
              reason_label: neden,
              message: `${fmtDateStr(istDateStr)} ${dayNames[day_of_week]} ${start_time} — ${staffName}: ${neden}`,
            });
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }

    res.json({ available: conflicts.length === 0, conflicts });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Uygunluk kontrolü yapılırken hata oluştu' });
  }
});

// Yeni üye paket ataması
router.post('/', [
  body('member_id').isInt(),
  body('package_id').isInt(),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('skip_day_distribution').optional().isBoolean(),
  body('slots').optional().isArray(),
  body('slots.*.day_of_week').optional().isInt({ min: 0, max: 6 }),
  body('slots.*.start_time').optional().trim(),
  body('slots.*.staff_id').optional().isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { member_id, package_id, start_date, end_date, skip_day_distribution = false, slots = [] } = req.body;

    // Seans dağılımı her zaman bugünden (Türkiye saati) ileriye yapılır; geçmiş start_date olsa bile geçmişe seans oluşturulmaz
    const todayTurkeyPost = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    const effectiveStart = start_date >= todayTurkeyPost ? start_date : todayTurkeyPost;

    // Her üye aynı anda yalnızca 1 aktif paket alabilir
    const existingActive = await db.query(
      'SELECT id, package_id FROM member_packages WHERE member_id = $1 AND status = $2 LIMIT 1',
      [member_id, 'active']
    );
    if (existingActive.rows.length > 0) {
      return res.status(400).json({
        error: 'Bu üyenin zaten aktif bir paketi var. Yeni paket eklemek için önce mevcut paketi "Sonlandır" ile kapatın.',
      });
    }

    const validSlots = (slots || []).filter((s) => s.day_of_week != null && s.start_time && s.staff_id != null);

    if (!skip_day_distribution && validSlots.length === 0) {
      return res.status(400).json({
        error: 'Seçili günler için saat ve personel seçiniz.',
      });
    }

    if (!skip_day_distribution && validSlots.length > 0) {
      const pkgRow = await db.query('SELECT lesson_count FROM packages WHERE id = $1', [package_id]);
      const lessonCount = pkgRow.rows[0]?.lesson_count ?? 0;
      if (lessonCount > 0) {
        const maxPossible = countPossibleSessionsInRange(effectiveStart, end_date, validSlots);
        if (maxPossible < lessonCount) {
          return res.status(400).json({
            error: `Seçilen tarih aralığı ve haftalık günlere göre en fazla ${maxPossible} randevu oluşturulabilir. Bu paket ${lessonCount} ders içeriyor. Lütfen bitiş tarihini uzatın veya haftalık gün sayısını artırın.`,
          });
        }
        const plan = buildPackageSessionInsertPlan(effectiveStart, end_date, validSlots, lessonCount, {
          memberId: member_id,
        });
        const preConflicts = await validatePackageSessionInserts(db, plan);
        if (preConflicts.length > 0) {
          return respondPackageSessionConflicts(res, db, preConflicts);
        }
      }
    }

    const result = await db.query(
      `INSERT INTO member_packages (member_id, package_id, start_date, end_date, skip_day_distribution, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [member_id, package_id, start_date, end_date, !!skip_day_distribution]
    );
    const mp = result.rows[0];

    for (const s of validSlots) {
      await db.query(
        `INSERT INTO member_package_slots (member_package_id, day_of_week, start_time, staff_id)
         VALUES ($1, $2, $3, $4)`,
        [mp.id, s.day_of_week, String(s.start_time).trim(), s.staff_id]
      );
    }

    let sessionConflicts = [];
    let sessionsCreated = 0;
    if (!skip_day_distribution && validSlots.length > 0) {
      const gen = await generateSessionsForMemberPackage(db, mp.id, member_id, effectiveStart, end_date, validSlots);
      sessionConflicts = gen.conflicts || [];
      sessionsCreated = gen.sessionsCreated || 0;
      if (sessionConflicts.length > 0) {
        await db.query('DELETE FROM member_packages WHERE id = $1', [mp.id]);
        return respondPackageSessionConflicts(res, db, sessionConflicts);
      }
    }

    const full = await db.query(
      `SELECT mp.*, p.name as package_name, p.lesson_count
       FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1`,
      [mp.id]
    );
    const slotsRes = await db.query(
      'SELECT id, day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1 ORDER BY day_of_week',
      [mp.id]
    );
    const row = full.rows[0];
    row.slots = slotsRes.rows;
    row.sessionConflicts = sessionConflicts;
    row.sessions_created = sessionsCreated;
    await fulfillPendingPackageRequestsForMember(db, member_id, mp.id, req.user.userId);
    await activityLog(req, {
      action: 'member_package.create',
      entityType: 'member_package',
      entityId: mp.id,
      details: {
        member_id: row.member_id,
        package_name: row.package_name || '',
        skip_day_distribution: !!skip_day_distribution,
      },
    }).catch(() => {});
    res.status(201).json(row);
  } catch (error) {
    console.error('Member package create error:', error);
    let msg = 'Üye paketi eklenirken hata oluştu.';
    if (error.code === '42P01') msg = 'member_packages tablosu yok. Lütfen backend/database/migration_member_packages.sql çalıştırın.';
    else if (error.code === '23503') msg = 'Üye, paket veya personel bulunamadı. (Foreign key)';
    else if (error.detail) msg = error.detail;
    else if (error.message) msg = process.env.NODE_ENV === 'production' ? msg : error.message;
    res.status(500).json({ error: msg });
  }
});

// Üye paket atamasını güncelle (tarih + slot'lar). effective_date: değişikliğin geçerli olduğu tarih; bu tarihten önceki seanslara dokunulmaz.
// İlk seans geçtiyse package_id (paket seçimi / seans sayısı) değiştirilemez; sadece tarih/gün/saat/personel değişikliği yapılabilir.
router.put('/:id', [
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('skip_day_distribution').optional().isBoolean(),
  body('effective_date').optional().isISO8601(),
  body('package_id').optional().isInt(),
  body('status').optional().isIn(['active', 'completed', 'cancelled']),
  body('slots').optional().isArray(),
  body('slots.*.day_of_week').optional().isInt({ min: 0, max: 6 }),
  body('slots.*.start_time').optional().trim(),
  body('slots.*.staff_id').optional().isInt(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { start_date, end_date, skip_day_distribution, effective_date, package_id: body_package_id, slots, status } = req.body;

    const existing = await db.query('SELECT * FROM member_packages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    }

    const mp = existing.rows[0];
    const nowMs = Date.now();

    // İlk QR/TELEFON/KART katılımını bul (bu seanslar değiştirilemez)
    let firstAttendedTs = null;
    const attendedSessionRes = await db.query(
      `SELECT MIN(start_ts) AS first_ts FROM sessions
       WHERE member_package_id = $1
         AND checked_in_at IS NOT NULL
         AND check_in_method IN ('qr', 'phone', 'card')
         AND deleted_at IS NULL`,
      [id]
    );
    firstAttendedTs = attendedSessionRes.rows[0]?.first_ts != null
      ? Number(attendedSessionRes.rows[0].first_ts)
      : null;

    // Paket türü değişiyorsa düşürme kontrolü
    if (body_package_id !== undefined && Number(body_package_id) !== Number(mp.package_id)) {
      const [oldPkgChk, newPkgChk] = await Promise.all([
        db.query('SELECT lesson_count FROM packages WHERE id = $1', [mp.package_id]),
        db.query('SELECT lesson_count FROM packages WHERE id = $1', [body_package_id]),
      ]);
      const oldLessons = Number(oldPkgChk.rows[0]?.lesson_count ?? 0);
      const newLessons = Number(newPkgChk.rows[0]?.lesson_count ?? 0);
      if (newLessons < oldLessons) {
        const pastChkRes = await db.query(
          'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts < $2 AND deleted_at IS NULL',
          [id, nowMs]
        );
        const pastChkCount = pastChkRes.rows[0]?.cnt ?? 0;
        if (pastChkCount >= newLessons) {
          return res.status(400).json({
            error: `Bu üye ${pastChkCount} seans kullanmış. En az ${pastChkCount + 1} seans içeren bir pakete geçiş yapılabilir.`,
          });
        }
      }
    }

    // İlk seans katılındıysa başlangıç tarihi değiştirilemez — sadece gerçekten değişiyorsa kontrol et
    if (start_date !== undefined && firstAttendedTs != null) {
      const currentStartStr = String(mp.start_date).slice(0, 10);
      const newStartStr = String(start_date).slice(0, 10);
      if (newStartStr !== currentStartStr) {
        // Değiştirilmeye çalışılıyor — ilk katılım tarihiyle eşleşmeli
        const firstDate = new Date(Number(firstAttendedTs) + 3 * 60 * 60 * 1000); // UTC+3
        const yyyy = firstDate.getUTCFullYear();
        const mm = String(firstDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(firstDate.getUTCDate()).padStart(2, '0');
        const firstAttendedDateStr = `${yyyy}-${mm}-${dd}`;
        const firstAttendedFmt = `${dd}.${mm}.${yyyy}`;
        if (newStartStr !== firstAttendedDateStr) {
          return res.status(400).json({
            error: `İlk randevuya katılım gerçekleştiği için başlangıç tarihi ${firstAttendedFmt} olarak sabitlenmiştir.`,
          });
        }
      }
    }

    // Güncellemeden önce mevcut slot'ları al (sadece tarih değişti mi karşılaştırmak için)
    const oldSlotsRes = await db.query(
      'SELECT day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1',
      [id]
    );
    const oldSlots = oldSlotsRes.rows;

    const finalPackageId = body_package_id !== undefined ? body_package_id : mp.package_id;
    const finalStartDate = start_date !== undefined ? start_date : mp.start_date;
    const finalEndDate = end_date !== undefined ? end_date : mp.end_date;
    const finalSkip = skip_day_distribution !== undefined ? !!skip_day_distribution : !!mp.skip_day_distribution;

    let validSlotsAfter;
    if (slots && Array.isArray(slots)) {
      validSlotsAfter = slots.filter((s) => s.day_of_week != null && s.start_time && s.staff_id != null);
      if (!finalSkip && validSlotsAfter.length === 0) {
        return res.status(400).json({
          error: 'Seçili günler için saat ve personel seçiniz.',
        });
      }
    } else {
      validSlotsAfter = oldSlots;
    }
    const slotsUnchanged = slotsEqual(oldSlots, validSlotsAfter);

    // Sadece bitiş tarihi değiştiyse (gün/saat/personel ve başlangıç tarihi aynıysa) randevu dağılımına dokunma
    const startDateUnchanged = start_date === undefined || String(start_date).slice(0, 10) === String(mp.start_date).slice(0, 10);
    const packageIdUnchanged = body_package_id === undefined || Number(body_package_id) === Number(mp.package_id);
    const onlyEndDateChanged = slotsUnchanged && startDateUnchanged && packageIdUnchanged;

    if (!finalSkip && validSlotsAfter.length > 0 && !onlyEndDateChanged) {
      const pkgRow = await db.query('SELECT lesson_count FROM packages WHERE id = $1', [finalPackageId]);
      const lessonCount = pkgRow.rows[0]?.lesson_count ?? 0;
      if (lessonCount > 0) {
        let genStart = null;
        let genEnd = String(finalEndDate).slice(0, 10);
        let genLimit = 0;

        if (slotsUnchanged) {
          const existingRes = await db.query(
            'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
            [id]
          );
          const existingCount = existingRes.rows[0]?.cnt ?? 0;
          const maxToCreate = Math.max(0, lessonCount - existingCount);
          if (maxToCreate > 0) {
            const neededEnd = computeEndDateForLessonCount(finalStartDate, validSlotsAfter, lessonCount);
            if (neededEnd > genEnd) genEnd = neededEnd;
            const lastRes = await db.query(
              `SELECT start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)
               ORDER BY start_ts DESC LIMIT 1`,
              [id]
            );
            genStart = String(finalStartDate).slice(0, 10);
            if (lastRes.rows[0]?.start_ts) {
              const lastDate = new Date(Number(lastRes.rows[0].start_ts));
              lastDate.setDate(lastDate.getDate() + 1);
              genStart = localDateStrFromTs(lastDate.getTime());
            }
            if (genStart <= genEnd) {
              const possible = countPossibleSessionsInRange(genStart, genEnd, validSlotsAfter);
              genLimit = Math.min(maxToCreate, possible);
            }
          }
        } else {
          // effective_date verilmemişse Turkey bugününü kullan (UTC'den bağımsız: +03:00)
          const todayTurkey = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
          const effectiveDateStr = effective_date && /^\d{4}-\d{2}-\d{2}$/.test(String(effective_date).trim())
            ? String(effective_date).trim()
            : todayTurkey;
          // effectiveDateStart: Turkey gece yarısını UTC'ye çevir (TZ bağımsız)
          const effectiveDateStart = new Date(effectiveDateStr + 'T00:00:00+03:00').getTime();
          // keptCount: effective_date önceki seanslar + effective_date'den itibaren katılım yapılmış seanslar (bunlar silinmez)
          const keptRes = await db.query(
            `SELECT COUNT(*)::int AS cnt FROM sessions
             WHERE member_package_id = $1 AND deleted_at IS NULL
               AND (
                 start_ts < $2
                 OR (start_ts >= $2 AND checked_in_at IS NOT NULL AND check_in_method IN ('qr', 'phone', 'card'))
               )`,
            [id, effectiveDateStart]
          );
          const keptCount = keptRes.rows[0]?.cnt ?? 0;
          const maxToCreate = Math.max(0, lessonCount - keptCount);
          // keptCount=0 ise geçmiş tarihleri atla: max(effectiveDateStr, paket başlangıcı)
          const pkgStartStr = String(finalStartDate).slice(0, 10);
          genStart = keptCount > 0
            ? effectiveDateStr
            : (effectiveDateStr >= pkgStartStr ? effectiveDateStr : pkgStartStr);
          const maxPossibleFromStart = countPossibleSessionsInRange(genStart, genEnd, validSlotsAfter);
          if (maxToCreate > 0 && maxPossibleFromStart < maxToCreate) {
            return res.status(400).json({
              error: `Değişiklik tarihinden (${effectiveDateStr}) sonra seçilen günlere göre en fazla ${maxPossibleFromStart} randevu oluşturulabilir. Kalan hak: ${maxToCreate}. Bitiş tarihini uzatın veya haftalık gün sayısını artırın.`,
            });
          }
          genLimit = maxToCreate;
        }

        if (genStart && genLimit > 0) {
          const plan = buildPackageSessionInsertPlan(genStart, genEnd, validSlotsAfter, genLimit, {
            memberId: mp.member_id,
            mpId: id,
          });
          const preConflicts = await validatePackageSessionInserts(db, plan, { excludeMemberPackageId: id });
          if (preConflicts.length > 0) {
            return respondPackageSessionConflicts(res, db, preConflicts);
          }
        }
      }
    }

    const updateFields = [];
    const values = [];
    let pi = 1;
    if (start_date !== undefined) {
      updateFields.push(`start_date = $${pi++}`);
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push(`end_date = $${pi++}`);
      values.push(end_date);
    }
    if (skip_day_distribution !== undefined) {
      updateFields.push(`skip_day_distribution = $${pi++}`);
      values.push(!!skip_day_distribution);
    }
    if (body_package_id !== undefined) {
      updateFields.push(`package_id = $${pi++}`);
      values.push(body_package_id);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${pi++}`);
      values.push(status);
    }
    if (updateFields.length > 0) {
      values.push(id);
      await db.query(`UPDATE member_packages SET ${updateFields.join(', ')} WHERE id = $${pi}`, values);
    }

    if (slots && Array.isArray(slots)) {
      const willSkip = skip_day_distribution !== undefined ? !!skip_day_distribution : !!mp.skip_day_distribution;
      const validSlotsInput = slots.filter((s) => s.day_of_week != null && s.start_time && s.staff_id != null);
      if (!willSkip && validSlotsInput.length === 0) {
        return res.status(400).json({
          error: 'Seçili günler için saat ve personel seçiniz.',
        });
      }
      await db.query('DELETE FROM member_package_slots WHERE member_package_id = $1', [id]);
      for (const s of validSlotsInput) {
        await db.query(
          `INSERT INTO member_package_slots (member_package_id, day_of_week, start_time, staff_id)
           VALUES ($1, $2, $3, $4)`,
          [id, s.day_of_week, String(s.start_time).trim(), s.staff_id]
        );
      }
    }

    const slotsResAfter = await db.query(
      'SELECT day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1',
      [id]
    );
    validSlotsAfter = slotsResAfter.rows;
    let sessionConflicts = [];
    let sessionsCreated = 0;
    let futureSessionIdsToRestore = [];

    // "Gün dağılımı yapmak istemiyorum" seçildiyse: geçmiş seanslara dokunma, sadece gelecek seansları iptal et (soft-delete).
    if (finalSkip) {
      await db.query(
        'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE member_package_id = $1 AND start_ts >= $2 AND (deleted_at IS NULL)',
        [id, nowMs]
      );
    }

    // "Gün dağılımı yapıyorum" (finalSkip=false), slotlar varken ve sadece bitiş tarihi değişmediyse
    if (!finalSkip && validSlotsAfter.length > 0 && !onlyEndDateChanged) {
      const pkgRow = await db.query('SELECT lesson_count FROM packages WHERE id = $1', [finalPackageId]);
      const lessonCount = pkgRow.rows[0]?.lesson_count ?? 0;
      if (lessonCount > 0) {
        // Gün/saat/personel değişmediyse sadece başlangıç/bitiş tarihleri güncellendi → seanslara dokunma, sadece member_packages tarihleri güncellendi (zaten yukarıda).
        if (slotsUnchanged) {
          const fill = await backfillMissingPackageSessions(
            db, id, mp.member_id, finalStartDate, finalEndDate, validSlotsAfter, lessonCount
          );
          sessionConflicts = fill.conflicts || [];
          sessionsCreated = fill.sessionsCreated || 0;

          // Düşürme: gün/saat değişmedi ama limit azaldı → fazla gelecek seansları en uzak tarihten sil
          const pastCntRes = await db.query(
            'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts < $2 AND deleted_at IS NULL',
            [id, nowMs]
          );
          const futureCntRes = await db.query(
            'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL',
            [id, nowMs]
          );
          const pastCnt = pastCntRes.rows[0]?.cnt ?? 0;
          const futureCnt = futureCntRes.rows[0]?.cnt ?? 0;
          const futureNeeded = Math.max(0, lessonCount - pastCnt);
          if (futureCnt > futureNeeded) {
            await db.query(
              `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP
               WHERE id IN (
                 SELECT id FROM sessions
                 WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL
                 ORDER BY start_ts DESC
                 LIMIT $3
               )`,
              [id, nowMs, futureCnt - futureNeeded]
            );
          }
        } else {
          // Gün/saat/personel değişti: geçmişe dokunma, gelecek seansları yeni dağılıma göre düzenle
          const todayTurkey = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
          const effectiveDateStr = effective_date && /^\d{4}-\d{2}-\d{2}$/.test(String(effective_date).trim())
            ? String(effective_date).trim()
            : todayTurkey;
          const effectiveDateStart = new Date(effectiveDateStr + 'T00:00:00+03:00').getTime();

          // keptCount: effective_date öncesi + o günden itibaren katılım yapılmış seanslar (silinmeyecek)
          const keptRes = await db.query(
            `SELECT COUNT(*)::int AS cnt FROM sessions
             WHERE member_package_id = $1 AND deleted_at IS NULL
               AND (
                 start_ts < $2
                 OR (start_ts >= $2 AND checked_in_at IS NOT NULL AND check_in_method IN ('qr', 'phone', 'card'))
               )`,
            [id, effectiveDateStart]
          );
          const keptCount = keptRes.rows[0]?.cnt ?? 0;
          const maxToCreate = Math.max(0, lessonCount - keptCount);

          // keptCount=0 ise geçmiş tarihleri atla: max(effectiveDateStr, paket başlangıcı) — ön-doğrulama bloğuyla tutarlı
          const pkgStartStrGen = String(finalStartDate).slice(0, 10);
          const generationStartStr = keptCount > 0
            ? effectiveDateStr
            : (effectiveDateStr >= pkgStartStrGen ? effectiveDateStr : pkgStartStrGen);
          const maxPossibleFromStart = countPossibleSessionsInRange(generationStartStr, finalEndDate, validSlotsAfter);

          if (maxToCreate > 0 && maxPossibleFromStart < maxToCreate) {
            return res.status(400).json({
              error: `Değişiklik tarihinden (${effectiveDateStr}) sonra seçilen günlere göre en fazla ${maxPossibleFromStart} randevu oluşturulabilir. Kalan hak: ${maxToCreate}. Bitiş tarihini uzatın veya haftalık gün sayısını artırın.`,
            });
          }
          const deleteFromTs = keptCount > 0 ? effectiveDateStart : new Date(generationStartStr + 'T00:00:00+03:00').getTime();
          // Katılım yapılmış seansları (kart/QR/telefon) silme — giriş kaydı korunmalı
          const futureRes = await db.query(
            `SELECT id FROM sessions WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL
             AND (checked_in_at IS NULL OR check_in_method NOT IN ('qr', 'phone', 'card'))`,
            [id, deleteFromTs]
          );
          futureSessionIdsToRestore = futureRes.rows.map((r) => r.id);
          await db.query(
            `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP
             WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL
               AND (checked_in_at IS NULL OR check_in_method NOT IN ('qr', 'phone', 'card'))`,
            [id, deleteFromTs]
          );
          const gen = await generateSessionsForMemberPackage(
            db, id, mp.member_id, generationStartStr, finalEndDate, validSlotsAfter, maxToCreate,
            { excludeMemberPackageId: id }
          );
          sessionConflicts = gen.conflicts || [];
          sessionsCreated = gen.sessionsCreated || 0;
        }
      }
    }

    if (sessionConflicts.length > 0) {
      await restoreMemberPackageAfterFailedGeneration(db, id, oldSlots, futureSessionIdsToRestore, !slotsUnchanged);
      return respondPackageSessionConflicts(res, db, sessionConflicts);
    }

    const full = await db.query(
      `SELECT mp.*, p.name as package_name, p.lesson_count
       FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1`,
      [id]
    );
    const slotsRes = await db.query(
      'SELECT id, day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1 ORDER BY day_of_week',
      [id]
    );
    const row = full.rows[0];
    row.slots = slotsRes.rows;
    row.sessionConflicts = sessionConflicts;
    row.sessions_created = sessionsCreated;
    await activityLog(req, { action: 'member_package.update', entityType: 'member_package', entityId: id, details: { member_id: mp.member_id, package_id: mp.package_id } }).catch(() => {});
    res.json(row);
  } catch (error) {
    console.error('Member package update error:', error);
    res.status(500).json({ error: 'Üye paketi güncellenirken hata oluştu' });
  }
});

// Üyeliği sonlandır: o ana kadarki seanslar kalır, sonraki seanslar iptal (silinir).
// body.end_date (YYYY-MM-DD) opsiyonel: kullanıcı saat dilimine göre "bugün" gönderilir; yoksa sunucu tarihi kullanılır.
router.post('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;
    const mpCheck = await db.query('SELECT id FROM member_packages WHERE id = $1 AND status = $2', [id, 'active']);
    if (mpCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı veya zaten sonlandırılmış' });
    }
    let endDateStr = req.body && typeof req.body.end_date === 'string' ? req.body.end_date.trim() : null;
    if (endDateStr && !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) endDateStr = null;
    const now = new Date();
    if (!endDateStr) {
      endDateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }
    const cutoffStart = new Date(endDateStr + 'T00:00:00').getTime();
    await db.query(
      'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE member_package_id = $1 AND start_ts >= $2',
      [id, cutoffStart]
    );
    const result = await db.query(
      `UPDATE member_packages SET status = 'completed', end_date = $2::date, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, endDateStr]
    );
    const ended = result.rows[0];
    await activityLog(req, { action: 'member_package.end', entityType: 'member_package', entityId: id, details: { end_date: endDateStr, member_id: ended?.member_id } }).catch(() => {});
    res.json(ended);
  } catch (error) {
    console.error('Member package end error:', error);
    res.status(500).json({ error: 'Üyelik sonlandırılırken hata oluştu' });
  }
});

// Bu paket atamasına bağlı seansları listele (MP-01: ortak sessionToDto)
router.get('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const mpRes = await db.query(
      `SELECT mp.*, p.package_type
       FROM member_packages mp
       JOIN packages p ON p.id = mp.package_id
       WHERE mp.id = $1`,
      [id]
    );
    if (mpRes.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    }
    const mp = mpRes.rows[0];

    const result = await db.query(
      `SELECT s.*, r.name AS room_name, cu.role AS confirmer_role
       FROM sessions s
       LEFT JOIN rooms r ON r.id = s.room_id
       ${ATTENDANCE_JOIN_SQL}
       WHERE s.member_package_id = $1
       ORDER BY s.start_ts ASC`,
      [id]
    );

    const staffMap = await loadStaffMap();
    const packageType = mp.package_type || 'fixed';
    const sessions = result.rows.map((row) =>
      sessionToDto(row, staffMap, packageType, mp.status, { forAdmin: true })
    );

    res.json(sessions);
  } catch (error) {
    console.error('Member package sessions error:', error);
    res.status(500).json({ error: 'Seanslar listelenirken hata oluştu' });
  }
});

export default router;
