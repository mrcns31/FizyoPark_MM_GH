// RN üye listesi testi için 50 gerçekçi Türkçe isimli üye ekler (hesapsız, sadece members kaydı).
// Çalıştırma: docker exec fp_backend node scripts/seed-50-members.js
import pg from 'pg';

const db = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const FIRST = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Murat', 'Emre', 'Yusuf',
  'Burak', 'Kemal', 'Serkan', 'Onur', 'Tolga', 'Volkan', 'Cem', 'Barış', 'Kaan', 'Eren',
  'Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Merve', 'Hatice', 'Emine', 'Selin', 'Esra', 'Büşra',
  'Derya', 'Gamze', 'Ceren', 'Sıla', 'Nur', 'Aslı', 'Pınar', 'Sevgi', 'Dilara', 'Melike',
  'Okan', 'Sinan', 'Deniz', 'Ozan', 'Furkan', 'Berk', 'Gökhan', 'Ufuk', 'Sema', 'Nilüfer',
];

const LAST = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek',
  'Polat', 'Korkmaz', 'Çakır', 'Erdoğan', 'Acar', 'Bulut', 'Güneş', 'Aksoy', 'Bal', 'Taş',
];

const PROFESSIONS = [
  'Öğretmen', 'Mühendis', 'Doktor', 'Avukat', 'Muhasebeci', 'Hemşire', 'Esnaf', 'Öğrenci',
  'Mimar', 'Memur', 'Emekli', 'Yazılımcı', 'Diş Hekimi', 'Eczacı', 'Bankacı', '',
];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function main() {
  // Mevcut max member_no'yu bul (U001 gibi), çakışmasın diye numaralandırmayı oradan başlat.
  const maxR = await db.query(
    "SELECT member_no FROM members WHERE member_no ~ '^U[0-9]+$' ORDER BY (substring(member_no from 2))::int DESC LIMIT 1"
  );
  let nextNo = 1;
  if (maxR.rows.length) nextNo = parseInt(maxR.rows[0].member_no.slice(1), 10) + 1;

  let inserted = 0;
  for (let i = 0; i < 50; i++) {
    const first = pick(FIRST, i * 7 + 3); // karışık dağılım
    const last = pick(LAST, i * 5 + 1);
    const name = `${first} ${last}`;
    const memberNo = 'U' + String(nextNo + i).padStart(3, '0');
    const phone = '0' + (530 + (i % 20)) + String(1000000 + i * 13337).slice(-7);
    const slug = (first + '.' + last)
      .toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
    const email = `${slug}${i}@example.com`;
    const profession = pick(PROFESSIONS, i * 3);

    await db.query(
      `INSERT INTO members (member_no, first_name, last_name, name, phone, email, profession, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())`,
      [memberNo, first, last, name, phone, email, profession || null]
    );
    inserted++;
  }

  const total = await db.query('SELECT count(*) FROM members WHERE deleted_at IS NULL');
  console.log(`SEED OK: ${inserted} üye eklendi. Toplam aktif üye: ${total.rows[0].count}`);
  await db.end();
}

main().catch((e) => {
  console.error('SEED HATA:', e.message);
  process.exit(1);
});
