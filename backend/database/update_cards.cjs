const fs = require('fs');
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

async function main() {
  const csvPath = process.argv[2] || 'D:\\26-01-2026-Cursor-Takip\\kullanici_kart.csv';

  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const rows = [];
  for (const line of content.split('\n').filter(l => l.trim())) {
    const [name, cardNo] = line.split(';').map(s => s.trim());
    if (name && cardNo) rows.push({ name, cardNo });
  }

  console.log(`${rows.length} kart kaydı okundu.`);

  const client = new Client(DB_CONFIG);
  await client.connect();

  // Önce tüm kartları sıfırla
  await client.query('UPDATE members SET card_no = NULL');
  console.log('Tüm card_no sıfırlandı.');

  let updated = 0, notFound = 0;

  for (const { name, cardNo } of rows) {
    const res = await client.query('SELECT id FROM members WHERE name = $1', [name]);
    if (res.rows.length === 0) {
      console.log(`BULUNAMADI: ${name}`);
      notFound++;
      continue;
    }
    await client.query('UPDATE members SET card_no = $1 WHERE id = $2', [cardNo, res.rows[0].id]);
    updated++;
  }

  await client.end();
  console.log(`\nTamamlandı: ${updated} kart atandı, ${notFound} üye bulunamadı.`);
}

main().catch(console.error);
