const fs = require('fs');
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 saat
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;    // UTC+3 (Türkiye)

const SKIP_NAMES = ['Deneme Seansı', 'Graston Seansı'];

function toEpochMs(tarihStr) {
  // "2025-04-30 13:00:00" → UTC epoch ms (UTC+3 olarak yorumla)
  const d = new Date(tarihStr.replace(' ', 'T') + '+03:00');
  return d.getTime();
}

async function main() {
  const csvPath = process.argv[2] || 'D:\\26-01-2026-Cursor-Takip\\randevular.csv';
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');

  const rows = [];
  for (const line of content.split('\n').filter(l => l.trim())) {
    const [memberName, staffName, tarih, eskiPaketId] = line.split(';').map(s => s.trim());
    if (!memberName || !staffName || !tarih) continue;
    if (SKIP_NAMES.some(skip => memberName.includes(skip))) continue;
    rows.push({ memberName, staffName, tarih, eskiPaketId });
  }

  console.log(`${rows.length} randevu okundu (Deneme/Graston atlandı).`);

  const client = new Client(DB_CONFIG);
  await client.connect();

  // Staff isim → id map
  const { rows: staffRows } = await client.query(
    'SELECT id, first_name, last_name FROM staff'
  );
  const staffMap = new Map();
  for (const s of staffRows) {
    staffMap.set(`${s.first_name} ${s.last_name}`.trim(), s.id);
  }

  // Üye isim → {id, member_package_id} — birden fazla aktif paket varsa en son tarihliyi al
  const { rows: memberRows } = await client.query(`
    SELECT DISTINCT ON (m.id) m.id, m.name, mp.id AS pkg_id
    FROM members m
    LEFT JOIN member_packages mp ON mp.member_id = m.id AND mp.status = 'active'
    WHERE m.deleted_at IS NULL
    ORDER BY m.id, mp.start_date DESC
  `);
  const memberMap = new Map();
  for (const m of memberRows) {
    memberMap.set(m.name, { memberId: m.id, packageId: m.pkg_id });
  }

  let inserted = 0, skipped = 0, notFound = 0;
  const seen = new Set(); // dedup: member_id + start_ts

  for (const { memberName, staffName, tarih } of rows) {
    const staff = staffMap.get(staffName);
    if (!staff) { console.log(`PERSONEL BULUNAMADI: ${staffName}`); skipped++; continue; }

    const member = memberMap.get(memberName);
    if (!member) { notFound++; continue; }

    const startTs = toEpochMs(tarih);
    const endTs = startTs + SESSION_DURATION_MS;
    const key = `${member.memberId}:${startTs}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    try {
      await client.query(`
        INSERT INTO sessions (member_id, staff_id, member_package_id, start_ts, end_ts)
        VALUES ($1, $2, $3, $4, $5)
      `, [member.memberId, staff, member.packageId, startTs, endTs]);
      inserted++;
    } catch (e) {
      console.error(`HATA [${memberName}]: ${e.message}`);
      skipped++;
    }
  }

  await client.end();
  console.log(`\nTamamlandı: ${inserted} seans eklendi, ${notFound} üye bulunamadı, ${skipped} atlandı.`);
}

main().catch(console.error);
