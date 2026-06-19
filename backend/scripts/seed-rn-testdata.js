// RN geliştirme için test verisi: 1 personel + 1 üye + aktif paket + seanslar.
// Çalıştırma: docker exec fp_backend node scripts/seed-rn-testdata.js
import pg from 'pg';
import bcrypt from 'bcrypt';

const db = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

async function upsertUser(username, email, password, role) {
  const hash = await bcrypt.hash(password, 10);
  const existing = await db.query('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
  if (existing.rows.length) {
    await db.query('UPDATE users SET password_hash=$1, role=$2, is_active=true WHERE id=$3', [hash, role, existing.rows[0].id]);
    return existing.rows[0].id;
  }
  const r = await db.query(
    'INSERT INTO users (username, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,true) RETURNING id',
    [username, email, hash, role]
  );
  return r.rows[0].id;
}

async function main() {
  // --- Personel ---
  const staffUserId = await upsertUser('personel', 'personel@local', 'personel123', 'staff');
  let staff = await db.query('SELECT id FROM staff WHERE user_id=$1', [staffUserId]);
  let staffId;
  if (staff.rows.length) {
    staffId = staff.rows[0].id;
  } else {
    const r = await db.query(
      "INSERT INTO staff (user_id, first_name, last_name, phone) VALUES ($1,'Mehmet','Fizyoterapist','5551112233') RETURNING id",
      [staffUserId]
    );
    staffId = r.rows[0].id;
  }

  // --- Üye ---
  const memberUserId = await upsertUser('uye', 'uye@local', 'uye123', 'member');
  let member = await db.query('SELECT id FROM members WHERE user_id=$1', [memberUserId]);
  let memberId;
  if (member.rows.length) {
    memberId = member.rows[0].id;
  } else {
    const r = await db.query(
      `INSERT INTO members (user_id, member_no, first_name, last_name, name, phone, email, profession)
       VALUES ($1,'U001','Ayşe','Yılmaz','Ayşe Yılmaz','5559998877','uye@local','Öğretmen') RETURNING id`,
      [memberUserId]
    );
    memberId = r.rows[0].id;
  }

  // --- Paket katalog ---
  let pkg = await db.query("SELECT id FROM packages WHERE name=$1", ['12 Seanslık Sabit Paket']);
  let packageId;
  if (pkg.rows.length) {
    packageId = pkg.rows[0].id;
  } else {
    const r = await db.query(
      "INSERT INTO packages (name, lesson_count, month_overrun, weekly_lesson_count, package_type) VALUES ($1,12,1,3,'fixed') RETURNING id",
      ['12 Seanslık Sabit Paket']
    );
    packageId = r.rows[0].id;
  }

  // --- Üye paketi (aktif) ---
  await db.query("DELETE FROM member_packages WHERE member_id=$1", [memberId]);
  const today = new Date();
  const startDate = new Date(today.getTime() - 7 * DAY).toISOString().slice(0, 10);
  const endDate = new Date(today.getTime() + 30 * DAY).toISOString().slice(0, 10);
  const mp = await db.query(
    "INSERT INTO member_packages (member_id, package_id, start_date, end_date, status) VALUES ($1,$2,$3,$4,'active') RETURNING id",
    [memberId, packageId, startDate, endDate]
  );
  const memberPackageId = mp.rows[0].id;

  // --- Seanslar: 2 geçmiş + 4 gelecek ---
  await db.query("DELETE FROM sessions WHERE member_id=$1", [memberId]);
  const base = new Date();
  base.setHours(10, 0, 0, 0);
  // bugün 3 seans (farklı saat) + geçmiş/gelecek
  const todaySlots = [0, 2 * HOUR, 4 * HOUR];
  const otherOffsets = [-5 * DAY, -2 * DAY, 1 * DAY, 3 * DAY, 6 * DAY];
  const offsets = [...todaySlots, ...otherOffsets];
  for (const off of offsets) {
    const start = base.getTime() + off;
    const end = start + HOUR;
    await db.query(
      `INSERT INTO sessions (staff_id, member_id, start_ts, end_ts, member_package_id, note)
       VALUES ($1,$2,$3,$4,$5,'')`,
      [staffId, memberId, start, end, memberPackageId]
    );
  }

  console.log('SEED OK:');
  console.log('  Personel:  personel@local / personel123  (staffId=' + staffId + ')');
  console.log('  Üye:       uye@local / uye123            (memberId=' + memberId + ')');
  console.log('  Paket:     12 Seanslık Sabit (aktif), 6 seans (2 geçmiş + 4 gelecek)');
  await db.end();
}

main().catch((e) => {
  console.error('SEED HATA:', e.message);
  process.exit(1);
});
