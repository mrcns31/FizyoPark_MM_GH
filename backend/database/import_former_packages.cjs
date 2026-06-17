const fs = require('fs');
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

const PAKET_MAP = {
  '1': 14,  // 36 Seans
  '2': 13,  // 24 Seans
  '3': 12,  // 12 Seans
  '4': 15,  // Aylık8
};

async function main() {
  const csvPath = process.argv[2] || 'D:\\26-01-2026-Cursor-Takip\\silindi_paketler.csv';
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');

  // Her üye için en son paketi al (start_date en büyük)
  const latestByName = new Map();
  for (const line of content.split('\n').filter(l => l.trim())) {
    const [name, eskiPaketId, startDate, endDate] = line.split(';').map(s => s.trim());
    if (!name || !eskiPaketId || !PAKET_MAP[eskiPaketId]) continue;
    const existing = latestByName.get(name);
    if (!existing || startDate > existing.startDate) {
      latestByName.set(name, { eskiPaketId, startDate, endDate });
    }
  }

  console.log(`${latestByName.size} eski üye için paket bulundu.`);

  const client = new Client(DB_CONFIG);
  await client.connect();

  // DB'deki üyeleri isimle eşleştir
  const { rows: dbMembers } = await client.query('SELECT id, name FROM members');
  const nameToId = new Map(dbMembers.map(r => [r.name, r.id]));

  const today = new Date().toISOString().split('T')[0];
  let inserted = 0, notFound = 0, skipped = 0;

  for (const [name, { eskiPaketId, startDate, endDate }] of latestByName) {
    const memberId = nameToId.get(name);
    if (!memberId) { console.log(`BULUNAMADI: ${name}`); notFound++; continue; }

    // Zaten paketi var mı?
    const existing = await client.query(
      'SELECT id FROM member_packages WHERE member_id = $1', [memberId]
    );
    if (existing.rows.length > 0) { skipped++; continue; }

    const yeniPaketId = PAKET_MAP[eskiPaketId];
    const status = endDate >= today ? 'active' : 'completed';

    try {
      await client.query(`
        INSERT INTO member_packages (member_id, package_id, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [memberId, yeniPaketId, startDate, endDate, status]);
      inserted++;
    } catch (e) {
      console.error(`HATA [${name}]: ${e.message}`);
      skipped++;
    }
  }

  await client.end();
  console.log(`\nTamamlandı: ${inserted} paket eklendi, ${notFound} üye bulunamadı, ${skipped} atlandı.`);
}

main().catch(console.error);
