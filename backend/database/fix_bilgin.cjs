const fs = require('fs');
const { Client } = require('pg');

const DB_CONFIG = { host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' };

const SESSION_DURATION_MS = 60 * 60 * 1000;

function toEpochMs(tarihStr) {
  return new Date(tarihStr.replace(' ', 'T') + '+03:00').getTime();
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  // 1. Burcu Bilgin'in deleted_at'ini sıfırla (aktif üye, yanlış işaretlenmiş)
  await client.query(`UPDATE members SET deleted_at = NULL WHERE id = 48`);
  console.log('Burcu Bilgin deleted_at temizlendi');

  // 2. İpek Bilgin paketi completed→active (5 seansı kaldı, henüz bitmemiş)
  await client.query(`UPDATE member_packages SET status = 'active' WHERE id = 271`);
  console.log('İpek Bilgin paketi active yapıldı');

  // 3. Staff map
  const { rows: staffRows } = await client.query('SELECT id, first_name, last_name FROM staff');
  const staffMap = new Map();
  for (const s of staffRows) staffMap.set(`${s.first_name} ${s.last_name}`.trim(), s.id);

  // 4. Bilgin üyeleri için CSV'den seans yükle
  const memberPkgMap = {
    'Burcu Bilgin': { memberId: 48, packageId: 4 },   // aktif paket id:4
    'İpek Bilgin':  { memberId: 49, packageId: 271 },  // paket id:271
    'İrem Bilgin':  { memberId: 50, packageId: null },  // zaten yüklü, geç
  };

  // İrem'in paket id'sini DB'den al
  const { rows: iremPkg } = await client.query(
    `SELECT id FROM member_packages WHERE member_id = 50 AND status = 'active' LIMIT 1`
  );
  if (iremPkg.length > 0) memberPkgMap['İrem Bilgin'].packageId = iremPkg[0].id;

  const csvPath = 'D:\\26-01-2026-Cursor-Takip\\randevular.csv';
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');

  const seen = new Set();
  // Mevcut seansları dedup'a ekle
  const { rows: existingSessions } = await client.query(
    `SELECT member_id, start_ts FROM sessions WHERE member_id IN (48, 49, 50)`
  );
  for (const s of existingSessions) seen.add(`${s.member_id}:${s.start_ts}`);

  let inserted = 0, skipped = 0;

  for (const line of content.split('\n').filter(l => l.trim())) {
    const [memberName, staffName, tarih] = line.split(';').map(s => s.trim());
    const info = memberPkgMap[memberName];
    if (!info || !info.packageId) continue;

    const staffId = staffMap.get(staffName);
    if (!staffId) { console.log(`Personel bulunamadı: ${staffName}`); skipped++; continue; }

    const startTs = toEpochMs(tarih);
    const key = `${info.memberId}:${startTs}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    try {
      await client.query(
        `INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts)
         VALUES ($1, $2, $3, $4, $5)`,
        [info.memberId, staffId, info.packageId, startTs, startTs + SESSION_DURATION_MS]
      );
      inserted++;
    } catch (e) {
      console.error(`HATA [${memberName} ${tarih}]: ${e.message}`);
      skipped++;
    }
  }

  // 5. Sonuç
  const { rows: r } = await client.query(`
    SELECT m.name, COUNT(s.id) AS seans_sayisi
    FROM members m
    LEFT JOIN sessions s ON s.member_id = m.id
    WHERE m.id IN (48, 49, 50)
    GROUP BY m.id, m.name ORDER BY m.name
  `);
  console.log('\nSonuç:');
  r.forEach(x => console.log(`  ${x.name}: ${x.seans_sayisi} seans`));

  await client.end();
  console.log(`\n${inserted} seans eklendi, ${skipped} atlandı.`);
}

main().catch(console.error);
