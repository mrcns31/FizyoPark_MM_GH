import express from 'express';
import { body, validationResult, query } from 'express-validator';
import db from '../config/database.js';
import { verifyToken } from './auth.js';
import { validateAndPickRoom } from '../utils/sessionSlot.js';
import { log as activityLog } from '../utils/activityLogger.js';

const router = express.Router();
router.use(verifyToken);

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

const DAY_NAMES = ['Pazar', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

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
 * Dolu saatlerde seans eklemez; çakışan günleri döndürür.
 * @param {number} [maxSessions] - En fazla bu kadar seans oluştur (güncellemede geçmiş seanslar korunuyorsa lesson_count - kept)
 * @returns {{ conflicts: Array<{ date: string, day_name: string, start_time: string, staff_id: number, message: string }> }}
 */
async function generateSessionsForMemberPackage(db, mpId, memberId, startDate, endDate, slots, maxSessions = null) {
  const conflicts = [];
  if (!slots || slots.length === 0) return { conflicts };
  const pkg = await db.query(
    'SELECT p.lesson_count FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1',
    [mpId]
  );
  const lessonCount = pkg.rows[0]?.lesson_count ?? 0;
  if (lessonCount <= 0) return { conflicts };
  const limit = maxSessions != null ? Math.max(0, Number(maxSessions)) : lessonCount;
  if (limit <= 0) return { conflicts };

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  const inserts = [];

  for (let d = new Date(start); d <= end && inserts.length < limit; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    for (const slot of slots) {
      if (inserts.length >= limit) break;
      if (Number(slot.day_of_week) !== dayOfWeek) continue;
      const [h, m] = (slot.start_time + '').split(':').map((x) => parseInt(x, 10) || 0);
      const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
      const startTs = slotStart.getTime();
      const endTs = startTs + SLOT_DURATION_MS;
      inserts.push({
        staff_id: slot.staff_id,
        member_id: memberId,
        start_ts: startTs,
        end_ts: endTs,
        member_package_id: mpId,
        start_time: slot.start_time,
        dateStr: d.toISOString().slice(0, 10),
        day_of_week: dayOfWeek,
      });
    }
  }

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
        message: 'Bu saatte oda müsait değil (kapasite dolu veya çalışma saati dışında)',
      });
      continue;
    }
    const roomId = validation.roomId ?? null;
    if (roomId == null) continue;
    // Transaction + oda kilidi: paralel isteklerde kapasite aşımını engeller
    let client;
    try {
      client = await db.pool.connect();
      await client.query('BEGIN');
      const roomRow = await client.query('SELECT id, devices FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
      if (roomRow.rows.length === 0) {
        await client.query('ROLLBACK');
        conflicts.push({
          date: row.dateStr,
          day_name: DAY_NAMES[row.day_of_week],
          start_time: row.start_time,
          staff_id: row.staff_id,
          message: 'Oda bulunamadı',
        });
        continue;
      }
      const devices = Math.max(1, parseInt(roomRow.rows[0].devices, 10) || 0);
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM sessions WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2 AND (deleted_at IS NULL)`,
        [roomId, row.start_ts, row.end_ts]
      );
      const currentSessions = parseInt(countResult.rows[0]?.cnt, 10) || 0;
      if (currentSessions >= devices) {
        await client.query('ROLLBACK');
        conflicts.push({
          date: row.dateStr,
          day_name: DAY_NAMES[row.day_of_week],
          start_time: row.start_time,
          staff_id: row.staff_id,
          message: 'Bu saatte oda müsait değil (kapasite dolu)',
        });
        continue;
      }
      await client.query(
        `INSERT INTO sessions (staff_id, member_id, room_id, start_ts, end_ts, note, member_package_id)
         VALUES ($1, $2, $3, $4, $5, NULL, $6)`,
        [row.staff_id, row.member_id, roomId, row.start_ts, row.end_ts, row.member_package_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      conflicts.push({
        date: row.dateStr,
        day_name: DAY_NAMES[row.day_of_week],
        start_time: row.start_time,
        staff_id: row.staff_id,
        message: 'Seans eklenirken hata',
      });
    } finally {
      if (client) client.release();
    }
  }
  return { conflicts };
}

// Üyeye ait paket atamalarını listele
router.get('/', [
  query('memberId').optional().isInt(),
], async (req, res) => {
  try {
    const { memberId } = req.query;
    let sql = `
      SELECT mp.*, p.name as package_name, p.lesson_count, p.month_overrun,
             COALESCE(TRIM(m.first_name || ' ' || m.last_name), m.name, '') as member_name, m.member_no
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

    const hasRoomAvailable = async (startTs, endTs) => {
      const rooms = await db.query('SELECT id, devices FROM rooms');
      for (const room of rooms.rows) {
        const r = await db.query(
          `SELECT COUNT(*)::int AS cnt FROM sessions
           WHERE room_id = $1 AND start_ts < $3 AND end_ts > $2`,
          [room.id, startTs, endTs]
        );
        const cnt = r.rows[0]?.cnt ?? 0;
        if (cnt < (room.devices ?? 1)) return true;
      }
      return false;
    };

    for (const slot of slots) {
      const { day_of_week, start_time, staff_id } = slot;
      const [h, m] = (start_time + '').split(':').map(Number);
      let d = new Date(start);
      while (d <= end) {
        if (d.getDay() === day_of_week) {
          const slotStart = new Date(d);
          slotStart.setHours(h, m || 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MS);
          const startTs = slotStart.getTime();
          const endTs = slotEnd.getTime();

          const roomOk = await hasRoomAvailable(startTs, endTs);
          if (!roomOk) {
            conflicts.push({
              date: d.toISOString().slice(0, 10),
              day_name: dayNames[day_of_week],
              start_time,
              staff_id,
              message: 'Bu saatte oda müsait değil (tüm odalar dolu)',
            });
          } else {
            let sql = `
              SELECT s.id, st.first_name || ' ' || st.last_name as staff_name
              FROM sessions s
              LEFT JOIN staff st ON st.id = s.staff_id
              WHERE s.staff_id = $1 AND s.start_ts < $3 AND s.end_ts > $2
            `;
            const params = [staff_id, startTs, endTs];
            if (exclude_member_package_id) {
              params.push(exclude_member_package_id);
              sql += ` AND (s.member_package_id IS NULL OR s.member_package_id != $${params.length})`;
            }
            const existing = await db.query(sql, params);
            if (existing.rows.length > 0) {
              conflicts.push({
                date: d.toISOString().slice(0, 10),
                day_name: dayNames[day_of_week],
                start_time,
                staff_id,
                message: `${existing.rows[0].staff_name} bu saatte başka seansı var ve bu saatte oda müsait değil`,
              });
            }
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

    if (!skip_day_distribution && validSlots.length > 0) {
      const pkgRow = await db.query('SELECT lesson_count FROM packages WHERE id = $1', [package_id]);
      const lessonCount = pkgRow.rows[0]?.lesson_count ?? 0;
      if (lessonCount > 0) {
        const maxPossible = countPossibleSessionsInRange(start_date, end_date, validSlots);
        if (maxPossible < lessonCount) {
          return res.status(400).json({
            error: `Seçilen tarih aralığı ve haftalık günlere göre en fazla ${maxPossible} randevu oluşturulabilir. Bu paket ${lessonCount} ders içeriyor. Lütfen bitiş tarihini uzatın veya haftalık gün sayısını artırın.`,
          });
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
    if (!skip_day_distribution && validSlots.length > 0) {
      const gen = await generateSessionsForMemberPackage(db, mp.id, member_id, start_date, end_date, validSlots);
      sessionConflicts = gen.conflicts || [];
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
    await activityLog(req, {
      action: 'member_package.create',
      entityType: 'member_package',
      entityId: mp.id,
      details: { package_name: row.package_name || '', skip_day_distribution: !!skip_day_distribution }
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
    const { start_date, end_date, skip_day_distribution, effective_date, package_id: body_package_id, slots } = req.body;

    const existing = await db.query('SELECT * FROM member_packages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    }

    const mp = existing.rows[0];
    const nowMs = Date.now();

    let firstTs = null;
    if (body_package_id !== undefined && Number(body_package_id) !== Number(mp.package_id)) {
      const firstSession = await db.query(
        'SELECT MIN(start_ts) AS first_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
        [id]
      );
      firstTs = firstSession.rows[0]?.first_ts != null ? Number(firstSession.rows[0].first_ts) : null;
      if (firstTs != null && firstTs < nowMs) {
        return res.status(400).json({
          error: 'İlk seans geçtiği için paket (seans sayısı) değiştirilemez. Tarih, gün, saat veya personel değişikliği yapabilirsiniz.',
        });
      }
    }

    // İlk seans geçtiyse paket başlangıç tarihi ilk seanstan sonra olamaz
    if (start_date !== undefined) {
      if (firstTs == null) {
        const firstSession = await db.query(
          'SELECT MIN(start_ts) AS first_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
          [id]
        );
        firstTs = firstSession.rows[0]?.first_ts != null ? Number(firstSession.rows[0].first_ts) : null;
      }
      if (firstTs != null && firstTs < nowMs) {
        const firstDate = new Date(firstTs);
        const firstSessionDateStr =
          firstDate.getFullYear() +
          '-' +
          String(firstDate.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(firstDate.getDate()).padStart(2, '0');
        const startDateStr = String(start_date).slice(0, 10);
        if (startDateStr > firstSessionDateStr) {
          return res.status(400).json({
            error: 'İlk seans tarihi geçtiği için paket başlangıç tarihi ilk seans tarihinden (' + firstSessionDateStr + ') sonra girilemez.',
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
    if (updateFields.length > 0) {
      values.push(id);
      await db.query(`UPDATE member_packages SET ${updateFields.join(', ')} WHERE id = $${pi}`, values);
    }

    const finalPackageId = body_package_id !== undefined ? body_package_id : mp.package_id;
    const finalStartDate = start_date !== undefined ? start_date : mp.start_date;
    const finalEndDate = end_date !== undefined ? end_date : mp.end_date;
    const finalSkip = skip_day_distribution !== undefined ? !!skip_day_distribution : !!mp.skip_day_distribution;

    if (slots && Array.isArray(slots)) {
      await db.query('DELETE FROM member_package_slots WHERE member_package_id = $1', [id]);
      const validSlots = slots.filter((s) => s.day_of_week != null && s.start_time && s.staff_id != null);
      for (const s of validSlots) {
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
    const validSlotsAfter = slotsResAfter.rows;
    const slotsUnchanged = slotsEqual(oldSlots, validSlotsAfter);
    let sessionConflicts = [];

    // "Gün dağılımı yapmak istemiyorum" seçildiyse: geçmiş seanslara dokunma, sadece gelecek seansları iptal et (soft-delete).
    if (finalSkip) {
      await db.query(
        'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE member_package_id = $1 AND start_ts >= $2 AND (deleted_at IS NULL)',
        [id, nowMs]
      );
    }

    // "Gün dağılımı yapıyorum" (finalSkip=false) ve slotlar varken
    if (!finalSkip && validSlotsAfter.length > 0) {
      const pkgRow = await db.query('SELECT lesson_count FROM packages WHERE id = $1', [finalPackageId]);
      const lessonCount = pkgRow.rows[0]?.lesson_count ?? 0;
      if (lessonCount > 0) {
        // Gün/saat/personel değişmediyse sadece başlangıç/bitiş tarihleri güncellendi → seanslara dokunma, sadece member_packages tarihleri güncellendi (zaten yukarıda).
        if (slotsUnchanged) {
          // Hiçbir seans silme/yeniden oluşturma
        } else {
          // Gün/saat/personel değişti: geçmişe dokunma, gelecek seansları yeni dağılıma göre düzenle
          const effectiveDateStr = effective_date && /^\d{4}-\d{2}-\d{2}$/.test(String(effective_date).trim())
            ? String(effective_date).trim()
            : new Date().toISOString().slice(0, 10);
          const effectiveDateStart = new Date(effectiveDateStr + 'T00:00:00').getTime();

          const keptRes = await db.query(
            'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND start_ts < $2 AND (deleted_at IS NULL)',
            [id, effectiveDateStart]
          );
          const keptCount = keptRes.rows[0]?.cnt ?? 0;
          const maxToCreate = Math.max(0, lessonCount - keptCount);

          const generationStartStr = keptCount > 0 ? effectiveDateStr : String(finalStartDate).slice(0, 10);
          const maxPossibleFromStart = countPossibleSessionsInRange(generationStartStr, finalEndDate, validSlotsAfter);

          if (maxToCreate > 0 && maxPossibleFromStart < maxToCreate) {
            return res.status(400).json({
              error: keptCount > 0
                ? `Değişiklik tarihinden (${effectiveDateStr}) sonra seçilen günlere göre en fazla ${maxPossibleFromStart} randevu oluşturulabilir. Kalan hak: ${maxToCreate}. Bitiş tarihini uzatın veya haftalık gün sayısını artırın.`
                : `Paket başlangıcından (${generationStartStr}) itibaren seçilen günlere göre en fazla ${maxPossibleFromStart} randevu oluşturulabilir. Bu paket ${lessonCount} ders içeriyor. Bitiş tarihini uzatın veya haftalık gün sayısını artırın.`,
            });
          }
          await db.query(
            'UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE member_package_id = $1 AND start_ts >= $2 AND (deleted_at IS NULL)',
            [id, keptCount > 0 ? effectiveDateStart : new Date(generationStartStr + 'T00:00:00').getTime()]
          );
          const gen = await generateSessionsForMemberPackage(db, id, mp.member_id, generationStartStr, finalEndDate, validSlotsAfter, maxToCreate);
          sessionConflicts = gen.conflicts || [];
        }
      }
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

// Bu paket atamasına bağlı seansları listele (geçmiş)
router.get('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const mpCheck = await db.query('SELECT id FROM member_packages WHERE id = $1', [id]);
    if (mpCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Üye paketi bulunamadı' });
    }

    const result = await db.query(
      `SELECT s.id, s.start_ts, s.end_ts, s.note,
              st.first_name || ' ' || st.last_name as staff_name,
              r.name as room_name
       FROM sessions s
       LEFT JOIN staff st ON st.id = s.staff_id
       LEFT JOIN rooms r ON r.id = s.room_id
       WHERE s.member_package_id = $1 AND (s.deleted_at IS NULL)
       ORDER BY s.start_ts ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Member package sessions error:', error);
    res.status(500).json({ error: 'Seanslar listelenirken hata oluştu' });
  }
});

export default router;
