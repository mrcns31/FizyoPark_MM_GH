import { formatPhone } from './phone.js';
import { ensureMemberUserAccount } from './memberAccount.js';
import { computeEndDateForLessonCount, generateSessionsForMemberPackage } from '../routes/member-packages.js';

const SEED_EMAIL_SUFFIX = '@seed.local';
const DEFAULT_SEED_COUNT = 110;
const SLOT_DURATION_MIN = 60;

const FIRST_NAMES = [
  'Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Burak', 'Selin', 'Emre', 'Deniz', 'Merve',
  'Kerem', 'Büşra', 'Oğuz', 'Gizem', 'Tolga', 'Seda', 'Barış', 'Pınar', 'Volkan', 'Aslı',
  'Hakan', 'Derya', 'Serkan', 'Esra', 'Murat', 'Cansu', 'Onur', 'Gamze', 'Umut', 'Hande',
  'Alp', 'Melis', 'Kaan', 'İrem', 'Berk', 'Tuğba', 'Efe', 'Yasemin', 'Arda', 'Nazlı',
  'Levent', 'Sevgi', 'Cem', 'Filiz', 'Tuncay', 'Gül', 'Sinan', 'Ayla', 'Erhan', 'Nihan',
];

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Koç',
  'Polat', 'Kurt', 'Acar', 'Güneş', 'Tekin', 'Aksoy', 'Bulut', 'Taş', 'Yavuz', 'Ergin',
  'Koçak', 'Aslan', 'Bozkurt', 'Çetin', 'Duman', 'Eren', 'Güler', 'Işık', 'Karaca', 'Lale',
  'Mutlu', 'Nadir', 'Özer', 'Parlak', 'Sarı', 'Tunç', 'Uçar', 'Vural', 'Yalçın', 'Zengin',
  'Akın', 'Bayram', 'Ceylan', 'Dinç', 'Erdem', 'Fidan', 'Gök', 'Han', 'Ilga', 'Jale',
];

export function seedMemberEmail(index) {
  return `test.uye.${String(index).padStart(3, '0')}${SEED_EMAIL_SUFFIX}`;
}

export function seedMemberPhone(index) {
  return formatPhone(String(5550000000 + index));
}

export function seedMemberName(index) {
  const fi = (index * 7 + 3) % FIRST_NAMES.length;
  const li = (index * 11 + 5 + Math.floor(index / FIRST_NAMES.length)) % LAST_NAMES.length;
  const firstName = FIRST_NAMES[fi];
  const lastName = LAST_NAMES[li];
  return { firstName, lastName, name: `${firstName} ${lastName}` };
}

function parseStaffWorkingHours(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function timeToMinutes(t) {
  const parts = String(t || '').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function loadGlobalWorkingHours(db) {
  const r = await db.query(
    'SELECT day_of_week, enabled, start_time, end_time FROM working_hours ORDER BY day_of_week'
  );
  const map = {};
  for (const row of r.rows) {
    map[row.day_of_week] = row;
  }
  return map;
}

function getStaffDayWindow(staffWh, dayOfWeek, globalWh) {
  const global = globalWh[dayOfWeek];
  if (!global || !global.enabled) return null;

  const dayWh = staffWh[String(dayOfWeek)] ?? staffWh[dayOfWeek];
  if (dayWh && dayWh.enabled === false) return null;

  let startMin = timeToMinutes(global.start_time);
  let endMin = timeToMinutes(global.end_time);

  if (dayWh && dayWh.start && dayWh.end) {
    startMin = Math.max(startMin, timeToMinutes(dayWh.start));
    endMin = Math.min(endMin, timeToMinutes(dayWh.end));
  }

  if (endMin - startMin < SLOT_DURATION_MIN) return null;
  return { startMin, endMin };
}

function timesInWindow(startMin, endMin) {
  const out = [];
  for (let m = startMin; m <= endMin - SLOT_DURATION_MIN; m += SLOT_DURATION_MIN) {
    out.push(minutesToTime(m));
  }
  return out;
}

/**
 * Tüm personellerin salon + kendi çalışma saatlerine göre atanabilir slot listesi.
 */
export async function buildStaffSlotCatalog(db) {
  const globalWh = await loadGlobalWorkingHours(db);
  const staffRes = await db.query('SELECT id, first_name, last_name, working_hours FROM staff ORDER BY id');
  const slots = [];

  for (const staff of staffRes.rows) {
    const staffWh = parseStaffWorkingHours(staff.working_hours);
    for (let day = 0; day <= 6; day += 1) {
      const window = getStaffDayWindow(staffWh, day, globalWh);
      if (!window) continue;
      for (const start_time of timesInWindow(window.startMin, window.endMin)) {
        slots.push({
          staff_id: staff.id,
          day_of_week: day,
          start_time,
        });
      }
    }
  }

  slots.sort(
    (a, b) =>
      a.staff_id - b.staff_id ||
      a.day_of_week - b.day_of_week ||
      a.start_time.localeCompare(b.start_time)
  );
  return slots;
}

export function pickSlotForIndex(index, slotCatalog) {
  if (!slotCatalog || !slotCatalog.length) return null;
  return slotCatalog[index % slotCatalog.length];
}

export async function getSeedTestMembersMeta(db) {
  let seedMemberCount = 0;
  try {
    const r = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM members
       WHERE LOWER(email) LIKE $1 AND (deleted_at IS NULL)`,
      ['%@seed.local']
    );
    seedMemberCount = r.rows[0]?.cnt ?? 0;
  } catch (_) {
    seedMemberCount = 0;
  }

  const [staffR, pkgR, roomR, slotCatalog] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS cnt FROM staff'),
    db.query('SELECT COUNT(*)::int AS cnt FROM packages'),
    db.query('SELECT COUNT(*)::int AS cnt FROM rooms'),
    buildStaffSlotCatalog(db),
  ]);

  const staffCount = staffR.rows[0]?.cnt ?? 0;
  const packageCount = pkgR.rows[0]?.cnt ?? 0;
  const roomCount = roomR.rows[0]?.cnt ?? 0;
  const slotCount = slotCatalog.length;
  const staffWithSlots = new Set(slotCatalog.map((s) => s.staff_id)).size;
  const ready = staffCount > 0 && packageCount > 0 && roomCount > 0 && slotCount > 0;

  return {
    seedMemberCount,
    staffCount,
    staffWithSlots,
    slotCount,
    packageCount,
    roomCount,
    ready,
    defaultCount: DEFAULT_SEED_COUNT,
    missing: [
      staffCount > 0 ? null : 'personel',
      packageCount > 0 ? null : 'paket tanımı',
      roomCount > 0 ? null : 'oda',
      slotCount > 0 ? null : 'personel çalışma saati (salon + personel)',
    ].filter(Boolean),
  };
}

/**
 * Test üyeleri: gerçekçi ad/soyad, tüm personellerin çalışma saatlerine göre dağıtılmış slotlar.
 */
export async function seedTestMembers(db, { count = DEFAULT_SEED_COUNT } = {}) {
  const total = Math.max(1, Math.min(200, Number(count) || DEFAULT_SEED_COUNT));
  const slotCatalog = await buildStaffSlotCatalog(db);
  const meta = await getSeedTestMembersMeta(db);
  if (!meta.ready || !slotCatalog.length) {
    throw Object.assign(
      new Error(`Önce ${meta.missing.join(', ')} tanımlayın.`),
      { code: 'PREREQUISITES' }
    );
  }

  const pkgRes = await db.query('SELECT id, name, lesson_count FROM packages ORDER BY id');
  const packages = pkgRes.rows;

  const startDate = new Date().toISOString().slice(0, 10);

  let created = 0;
  let skipped = 0;
  let sessionsCreated = 0;
  let conflictCount = 0;
  const errors = [];
  const staffUsed = new Set();

  for (let i = 1; i <= total; i += 1) {
    const email = seedMemberEmail(i);
    const dup = await db.query('SELECT id FROM members WHERE LOWER(email) = LOWER($1)', [email]);
    if (dup.rows.length > 0) {
      skipped++;
      continue;
    }

    const phone = seedMemberPhone(i);
    if (!phone) {
      errors.push(`Üye ${i}: geçersiz telefon`);
      continue;
    }

    const { firstName, lastName, name } = seedMemberName(i);
    const slot = pickSlotForIndex(i - 1, slotCatalog);
    if (!slot) {
      errors.push(`Üye ${i}: uygun slot yok`);
      continue;
    }
    staffUsed.add(slot.staff_id);
    const pkg = packages[(i - 1) % packages.length];
    const endDate = computeEndDateForLessonCount(startDate, [slot], pkg.lesson_count);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const nextNoResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(member_no FROM 3) AS INTEGER)), 0) + 1 AS next_num
         FROM members WHERE member_no ~ '^FP[0-9]+$'`
      );
      const memberNo = 'FP' + String(parseInt(nextNoResult.rows[0]?.next_num || 1, 10)).padStart(3, '0');

      const ins = await client.query(
        `INSERT INTO members (
          member_no, first_name, last_name, name, phone, email, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [memberNo, firstName, lastName, name, phone, email, 'Test şablonu – otomatik oluşturuldu']
      );
      let member = ins.rows[0];
      await ensureMemberUserAccount(client, member);
      const refreshed = await client.query('SELECT * FROM members WHERE id = $1', [member.id]);
      member = refreshed.rows[0];

      const mpIns = await client.query(
        `INSERT INTO member_packages (member_id, package_id, start_date, end_date, skip_day_distribution, status)
         VALUES ($1, $2, $3, $4, false, 'active') RETURNING id`,
        [member.id, pkg.id, startDate, endDate]
      );
      const mpId = mpIns.rows[0].id;

      await client.query(
        `INSERT INTO member_package_slots (member_package_id, day_of_week, start_time, staff_id)
         VALUES ($1, $2, $3, $4)`,
        [mpId, slot.day_of_week, slot.start_time, slot.staff_id]
      );

      await client.query('COMMIT');

      const beforeSessions = await db.query(
        'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_id = $1 AND deleted_at IS NULL',
        [member.id]
      );
      const beforeCnt = beforeSessions.rows[0]?.cnt ?? 0;

      const gen = await generateSessionsForMemberPackage(db, mpId, member.id, startDate, endDate, [slot]);
      conflictCount += (gen.conflicts || []).length;

      const afterSessions = await db.query(
        'SELECT COUNT(*)::int AS cnt FROM sessions WHERE member_id = $1 AND deleted_at IS NULL',
        [member.id]
      );
      sessionsCreated += Math.max(0, (afterSessions.rows[0]?.cnt ?? 0) - beforeCnt);
      created++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      errors.push(`${name}: ${err.message || 'eklenemedi'}`);
    } finally {
      client.release();
    }
  }

  return {
    requested: total,
    created,
    skipped,
    sessionsCreated,
    sessionConflicts: conflictCount,
    staffAssigned: staffUsed.size,
    slotCatalogSize: slotCatalog.length,
    startDate,
    errors: errors.slice(0, 10),
    errorsTruncated: errors.length > 10,
  };
}
