// Puanlama sistemini yerelde test etmek için veri hazırlar.
// Önce seed-rn-testdata.js çalıştırılmış olmalı (üye + personel + paket + seanslar).
//
// Yaptıkları:
//   1. ratings_go_live_ts'i 30 gün öncesine çeker — normalde migration anına set edilir,
//      o hâliyle mevcut seanslar puanlanamaz ve test edilecek bir şey kalmaz.
//   2. Üyenin geçmiş seanslarını "geldi" olarak işaretler (puanlanabilir hâle gelir).
//   3. 30 dakika önce bitmiş, giriş yapılmış bir seans ekler — puanlama daveti hemen çıksın.
//
// Çalıştırma: cd backend && node scripts/seed-rating-testdata.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

async function main() {
  // Bu script seans verisini değiştirir ve puanlamanın devreye alma tarihini geriye çeker.
  // Canlıda çalıştırılırsa 1 Ağustos kısıtını sessizce kaldırır — o yüzden kapalı.
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Bu script yalnızca geliştirme ortamı içindir (NODE_ENV=production).');
    process.exit(1);
  }

  const now = Date.now();

  // 1) Puanlama başlangıcını geriye çek (YALNIZCA yerel test için)
  const goLive = now - 30 * DAY;
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('ratings_go_live_ts', $1, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [String(goLive)]
  );

  // 2) Test üyesini bul — seed-rn-testdata'nın üyesi (uye@local) öncelikli.
  //    CLI'dan üye id verilebilir: node scripts/seed-rating-testdata.js 375
  const wantedId = Number(process.argv[2]) || null;
  const memberRes = await db.query(
    `SELECT m.id, m.name, m.user_id
     FROM members m
     JOIN users u ON u.id = m.user_id
     WHERE m.deleted_at IS NULL AND u.role = 'member'
       AND ($1::int IS NULL OR m.id = $1::int)
     ORDER BY (u.email = 'uye@local') DESC, m.id
     LIMIT 1`,
    [wantedId]
  );
  if (!memberRes.rows.length) {
    console.error('❌ Hesabı olan üye bulunamadı. Önce: node scripts/seed-rn-testdata.js');
    process.exit(1);
  }
  const member = memberRes.rows[0];

  // 3) Geçmiş seansları "geldi" yap → puanlanabilir hâle gelir
  const marked = await db.query(
    `UPDATE sessions
     SET checked_in_at = to_timestamp(start_ts / 1000.0),
         check_in_method = 'qr',
         attendance_outcome = 'present',
         updated_at = CURRENT_TIMESTAMP
     WHERE member_id = $1
       AND deleted_at IS NULL
       AND end_ts < $2
       AND end_ts >= $3
       AND checked_in_at IS NULL
     RETURNING id`,
    [member.id, now, goLive]
  );

  // 4) 30 dk önce bitmiş, girişi yapılmış seans ekle → puanlama daveti hemen çıkar
  const ctx = await db.query(
    `SELECT staff_id, member_package_id, room_id
     FROM sessions
     WHERE member_id = $1 AND staff_id IS NOT NULL
     ORDER BY start_ts DESC LIMIT 1`,
    [member.id]
  );
  if (!ctx.rows.length) {
    console.error('❌ Üyenin personel atanmış seansı yok. Önce: node scripts/seed-rn-testdata.js');
    process.exit(1);
  }
  const { staff_id, member_package_id, room_id } = ctx.rows[0];

  // Randevular tam saat başında olur; test seansı da öyle olsun ki
  // bildirim metnindeki saat gerçekçi görünsün (14:28 gibi bir değer çıkmasın).
  const end = Math.floor((now - 30 * 60 * 1000) / HOUR) * HOUR;
  const start = end - HOUR;

  await db.query('DELETE FROM sessions WHERE member_id = $1 AND note = $2', [member.id, 'puanlama-testi']);
  const fresh = await db.query(
    `INSERT INTO sessions (staff_id, member_id, room_id, member_package_id, start_ts, end_ts, note,
                           checked_in_at, check_in_method, attendance_outcome)
     VALUES ($1, $2, $3, $4, $5::bigint, $6, 'puanlama-testi',
             to_timestamp($5::bigint / 1000.0), 'qr', 'present')
     RETURNING id`,
    [staff_id, member.id, room_id, member_package_id, start, end]
  );

  // Bu seansa daha önce puan/davet verilmişse temizle — script tekrar çalıştırılabilir olsun
  await db.query('DELETE FROM session_ratings WHERE member_id = $1', [member.id]);
  await db.query(
    `DELETE FROM session_reminders
     WHERE reminder_type = 'rating'
       AND session_id IN (SELECT id FROM sessions WHERE member_id = $1)`,
    [member.id]
  );

  console.log('SEED OK — puanlama testi hazır:');
  console.log(`  Üye:                ${member.name} (id=${member.id})`);
  console.log(`  ratings_go_live_ts: ${new Date(goLive).toLocaleString('tr-TR')}`);
  console.log(`  "Geldi" yapılan:    ${marked.rows.length} geçmiş seans`);
  console.log(`  Yeni test seansı:   id=${fresh.rows[0].id}, 30 dk önce bitti`);
  console.log('');
  console.log('  → Üye hesabıyla girip ana ekranı açın: puanlama sheet\'i açılmalı.');
  await db.end();
}

main().catch((e) => {
  console.error('SEED HATA:', e.message);
  process.exit(1);
});
