import { placeSessionWithRebalance } from './sessionSlot.js';

const SLOT_DURATION_MS = 60 * 60 * 1000;

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
 * @returns {Promise<number|null>} member_package_id veya null
 */
export async function resolveMemberPackageId(db, memberId, startTs) {
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

/**
 * MP-03: Admin seans silme ve üye iptal — aynı mükerrer iptal + telafi parametreleri.
 * Aynı member_id + start_ts aktif kayıtlarının tamamını soft-delete eder;
 * ardından addNextSessionAfterLastForPackage(afterCancelTs, skipStartTs) çağırır.
 */
export async function cancelPackageSessionsAtSlot(db, {
  memberId,
  startTs,
  memberPackageId = null,
  deletedBy = null,
}) {
  const cancelRes = await db.query(
    `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $3
     WHERE member_id = $1 AND start_ts = $2 AND deleted_at IS NULL
     RETURNING id, member_package_id`,
    [memberId, startTs, deletedBy]
  );

  const cancelledIds = cancelRes.rows.map((r) => r.id);
  let mpId = memberPackageId;
  if (mpId == null) {
    mpId = cancelRes.rows.find((r) => r.member_package_id != null)?.member_package_id ?? null;
  }
  if (mpId == null && memberId != null && startTs != null) {
    mpId = await resolveMemberPackageId(db, memberId, startTs);
  }

  let replenished = { added: false };
  if (mpId != null) {
    replenished = await addNextSessionAfterLastForPackage(db, mpId, {
      afterCancelTs: startTs,
      skipStartTs: startTs,
    });
  }

  return { cancelledIds, replenished, memberPackageId: mpId };
}

const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// Türkçe yönelme eki saatin okunuşuna göre değişir: 11:00'e, 12:00'ye, 16:00'ya, 19:00'a.
// Index = saat (0-23). Dakika 00 değilse ek dakikaya göre belirlenir.
const HOUR_SUFFIX_TR = ['a', 'e', 'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a', 'a', 'e',
  'ye', 'e', 'e', 'e', 'ya', 'ye', 'e', 'a', 'ye', 'e', 'ye', 'e'];
const MINUTE_SUFFIX_TR = { 15: 'e', 30: 'a', 45: 'e' };

/** "11:00'e" / "12:30'a" — üyeye gösterilen metinlerde kullanılır. */
export function formatTimeWithSuffix(hh, mm) {
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const suffix = mm ? (MINUTE_SUFFIX_TR[mm] || 'e') : (HOUR_SUFFIX_TR[hh] || 'e');
  return `${time}'${suffix}`;
}

/** "29.09.2026 Salı 11:00" — ek almadan düz etiket (admin metinleri ve listeler için). */
export function formatPlacedAtLabel(placedAt) {
  if (!placedAt || !placedAt.date) return '';
  const [yyyy, mm, dd] = String(placedAt.date).split('-');
  return `${dd}.${mm}.${yyyy} ${placedAt.day_name || ''} ${placedAt.start_time || ''}`.replace(/\s+/g, ' ').trim();
}

/**
 * Telafi seansı eklendiğinde üyeye gösterilecek metin.
 * Web ve mobil aynı metni kullansın diye sunucuda kuruluyor.
 * @param {{date: string, day_name: string, start_time: string}|null} placedAt
 */
export function buildReplenishedMessage(placedAt) {
  if (!placedAt || !placedAt.date) {
    return 'Telafi randevunuz otomatik olarak paketinizin sonuna eklendi.';
  }
  const [yyyy, mm, dd] = String(placedAt.date).split('-');
  const [h, m] = String(placedAt.start_time || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
  return `Telafi randevunuz ${dd}.${mm}.${yyyy} ${placedAt.day_name || ''} ${formatTimeWithSuffix(h, m)} otomatik olarak paketinizin sonuna eklendi.`.replace(/\s+/g, ' ');
}

/** DB date / ISO → yerel gün başlangıcı */
function toLocalDay(val) {
  if (val == null || val === '') return new Date(NaN);
  const s = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return new Date(NaN);
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 0, 0, 0, 0);
}

/**
 * Paketten seans silindiğinde bir telafi seansı ekler.
 * @param {object} [options]
 * @param {number} [options.afterCancelTs] — iptal edilen seansın start_ts; arama bu tarihten sonra da başlar
 * @param {number} [options.skipStartTs] — bu iptalin start_ts (ayrıca pakette daha önce iptal edilmiş tüm slotlar da atlanır)
 * @returns {Promise<{ added: boolean, sessionId?: number, reason?: string }>}
 */
export async function addNextSessionAfterLastForPackage(db, memberPackageId, options = {}) {
  try {
    const mp = await db.query(
      `SELECT mp.member_id, mp.start_date, mp.end_date, p.lesson_count
       FROM member_packages mp JOIN packages p ON p.id = mp.package_id WHERE mp.id = $1`,
      [memberPackageId]
    );
    if (mp.rows.length === 0) return { added: false, reason: 'package_not_found' };

    const { member_id, start_date, end_date, lesson_count } = mp.rows[0];
    const countRes = await db.query(
      'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL)',
      [memberPackageId]
    );
    const count = countRes.rows[0]?.cnt ?? 0;
    if (count >= lesson_count) {
      return { added: false, reason: 'package_full' };
    }

    const lastRes = await db.query(
      'SELECT start_ts FROM sessions WHERE member_package_id = $1 AND (deleted_at IS NULL) ORDER BY start_ts DESC LIMIT 1',
      [memberPackageId]
    );

    const end = toLocalDay(end_date);
    end.setHours(23, 59, 59, 999);
    if (Number.isNaN(end.getTime())) {
      console.error('addNextSessionAfterLastForPackage: geçersiz end_date', end_date);
      return { added: false, reason: 'invalid_end_date' };
    }

    let startDay = toLocalDay(start_date);
    if (lastRes.rows.length > 0) {
      const lastDay = new Date(Number(lastRes.rows[0].start_ts));
      startDay = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1, 0, 0, 0, 0);
    }
    if (options.afterCancelTs != null) {
      const cancelDay = new Date(Number(options.afterCancelTs));
      const fromCancel = new Date(cancelDay.getFullYear(), cancelDay.getMonth(), cancelDay.getDate() + 1, 0, 0, 0, 0);
      if (!Number.isNaN(fromCancel.getTime()) && fromCancel.getTime() > startDay.getTime()) {
        startDay = fromCancel;
      }
    }
    if (Number.isNaN(startDay.getTime())) {
      return { added: false, reason: 'invalid_start' };
    }

    const slotsRes = await db.query(
      'SELECT day_of_week, start_time, staff_id FROM member_package_slots WHERE member_package_id = $1',
      [memberPackageId]
    );
    const slots = slotsRes.rows;
    if (slots.length === 0) {
      console.error('addNextSessionAfterLastForPackage: slot yok, mp=', memberPackageId);
      return { added: false, reason: 'no_slots' };
    }

    // Slot personellerinin adları tek sorguda — aday listesi ve yerleşen seans için gerekiyor
    const staffNames = {};
    const slotStaffIds = [...new Set(slots.map((s) => s.staff_id).filter((x) => x != null))];
    if (slotStaffIds.length > 0) {
      const namesRes = await db.query(
        "SELECT id, first_name || ' ' || last_name AS name FROM staff WHERE id = ANY($1::int[])",
        [slotStaffIds]
      ).catch(() => ({ rows: [] }));
      for (const row of namesRes.rows) staffNames[row.id] = row.name;
    }

    // Yalnızca ÜYENİN iptal ettiği tarihler telafiye kapalıdır — üye "o gün gelemem" demiştir.
    // Sistemin kendi sildikleri (deleted_by NULL: paket yeniden planlama, hak taşması trim'i) ve
    // admin iptalleri atlanmaz; atlanırsa o tarih pakette kalıcı olarak kullanılamaz hale gelir ve
    // telafi bir sonraki slota kayar. Aynı kural toplu üretimde de geçerli (member-packages.js).
    const cancelledRes = await db.query(
      `SELECT DISTINCT s.start_ts FROM sessions s
       JOIN users du ON du.id = s.deleted_by AND du.role = 'member'
       WHERE s.member_package_id = $1 AND s.deleted_at IS NOT NULL`,
      [memberPackageId]
    );
    const cancelledStartTs = new Set(
      cancelledRes.rows.map((r) => Number(r.start_ts)).filter((ts) => Number.isFinite(ts))
    );
    if (options.skipStartTs != null) {
      cancelledStartTs.add(Number(options.skipStartTs));
    }

    // Kapanış (tatil) günlerine telafi seansı yerleştirilmez. Önceden bu koruma yoktu; yukarıdaki
    // filtre daraldığı için burada açıkça kontrol edilmeli.
    const closureRes = await db.query(
      'SELECT start_date::text AS start_date, end_date::text AS end_date FROM closure_periods'
    );
    const closureRanges = closureRes.rows.map((r) => ({
      start: String(r.start_date).slice(0, 10),
      end: String(r.end_date).slice(0, 10),
    }));
    const isClosedDay = (dateStr) =>
      closureRanges.some((r) => dateStr >= r.start && dateStr <= r.end);

    // Atlanan adaylar: telafinin neden ileri bir tarihe kaydığı loglardan görülebilsin.
    // Yapı, check-availability çakışma şemasıyla aynı — admin arayüzü ikisini tek bileşenle gösterir.
    const skipped = [];
    const pushSkip = (dateStr, dayOfWeek, timeStr, staffId, reasonCode, reasonLabel) => {
      skipped.push({
        date: dateStr,
        day_name: DAY_NAMES_TR[dayOfWeek],
        day_of_week: dayOfWeek,
        start_time: timeStr,
        staff_id: staffId ?? null,
        staff_name: staffNames[staffId] || '',
        reason_code: reasonCode,
        reason_label: reasonLabel,
      });
    };
    const skippedForLog = () => skipped.map((s) => `${s.date} ${s.start_time}: ${s.reason_label}`);

    for (let d = new Date(startDay.getTime()); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      // buildPackageSessionInsertPlan ile tutarlı: Türkiye saati (+03:00) kullan
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (isClosedDay(dateStr)) continue;
      for (const slot of slots) {
        if (Number(slot.day_of_week) !== dayOfWeek) continue;
        const timeStr = String(slot.start_time || '08:00');
        const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
        const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`);
        const startTs = slotStart.getTime();
        const endTs = startTs + SLOT_DURATION_MS;

        const slotTime = `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;

        if (cancelledStartTs.has(startTs)) {
          pushSkip(dateStr, dayOfWeek, slotTime, slot.staff_id, 'member_cancelled', 'üye daha önce iptal etmiş');
          continue;
        }

        const dup = await db.query(
          `SELECT id FROM sessions
           WHERE member_package_id = $1 AND member_id = $2 AND start_ts = $3 AND (deleted_at IS NULL)
           LIMIT 1`,
          [memberPackageId, member_id, startTs]
        );
        if (dup.rows.length > 0) {
          pushSkip(dateStr, dayOfWeek, slotTime, slot.staff_id, 'already_exists', 'zaten seans var');
          continue;
        }

        const placed = await placeSessionWithRebalance(db, {
          staffId: slot.staff_id,
          startTs,
          endTs,
          memberId: member_id,
          memberPackageId,
        });
        if (!placed.ok) {
          const err = placed.error || 'yerleştirilemedi';
          const code = /çalışma saati/i.test(err) ? 'outside_working_hours'
            : /kapasite/i.test(err) ? 'capacity_full'
            : 'placement_failed';
          pushSkip(dateStr, dayOfWeek, slotTime, slot.staff_id, code, err);
          continue;
        }

        if (skipped.length > 0) {
          console.warn('addNextSessionAfterLastForPackage: aday tarihler atlandı', {
            memberPackageId,
            yerlesen: `${dateStr} ${slotTime}`,
            atlananlar: skippedForLog(),
          });
        }
        // Telafinin nereye konduğu — üyeye/admin'e gösterilen metinler bunu kullanır.
        // Alan adları check-availability çakışma şemasıyla aynı tutuldu.
        const placedAt = {
          start_ts: startTs,
          date: dateStr,
          day_name: DAY_NAMES_TR[dayOfWeek],
          day_of_week: dayOfWeek,
          start_time: slotTime,
          staff_id: slot.staff_id,
          staff_name: staffNames[slot.staff_id] || '',
        };
        return { added: true, sessionId: placed.sessionId, skipped, placedAt };
      }
    }

    console.error('addNextSessionAfterLastForPackage: uygun gün bulunamadı', {
      memberPackageId,
      startDay: startDay.toISOString(),
      end: end.toISOString(),
      count,
      lesson_count,
      atlananlar: skippedForLog(),
    });
    // candidates: adminin "neden yerleşmedi" sorusunu ekranda cevaplayabilmesi için
    return { added: false, reason: 'no_available_slot', candidates: skipped, packageEndDate: String(end_date).slice(0, 10) };
  } catch (err) {
    console.error('addNextSessionAfterLastForPackage error:', err);
    return { added: false, reason: 'error' };
  }
}
