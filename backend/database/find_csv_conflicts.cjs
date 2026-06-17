const fs = require('fs');
const { Client } = require('pg');

const DB_CONFIG = { host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' };

function parseName(line) {
  // silindi_uyeler.csv format: 16 sütun, ilk sütun ad soyad
  return line.split(';')[0].trim();
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  // DB'deki hem aktif hem eski üye olarak kayıtlı isimler
  const { rows } = await client.query(`
    SELECT name,
      SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS aktif,
      SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS eski
    FROM members
    GROUP BY name
    HAVING SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) > 0
    ORDER BY name
  `);

  console.log(`=== HEM AKTİF HEM ESKİ ÜYE OLARAK KAYITLI (${rows.length} adet) ===`);
  if (rows.length === 0) {
    console.log('Yok');
  } else {
    rows.forEach(r => console.log(`${r.name} | aktif: ${r.aktif}, eski: ${r.eski}`));
  }

  // randevular.csv'deki isimler DB'de aktif mi eski mi?
  const csv = fs.readFileSync('D:\\26-01-2026-Cursor-Takip\\randevular.csv', 'utf-8').replace(/^﻿/, '');
  const csvNames = new Set(csv.split('\n').filter(l => l.trim()).map(l => l.split(';')[0].trim()));

  const { rows: dbRows } = await client.query(`
    SELECT id, name, deleted_at FROM members ORDER BY name
  `);
  const dbByName = new Map();
  for (const r of dbRows) dbByName.set(r.name, r);

  const notFoundInDB = [...csvNames].filter(n => !dbByName.has(n));
  const foundButDeleted = [...csvNames].filter(n => dbByName.has(n) && dbByName.get(n).deleted_at !== null);

  console.log(`\n=== randevular.csv'DE VAR AMA YENİ DB'DE BULUNMUYOR (${notFoundInDB.length} adet) ===`);
  notFoundInDB.slice(0, 30).forEach(n => console.log(`  ${n}`));
  if (notFoundInDB.length > 30) console.log(`  ... ve ${notFoundInDB.length - 30} tane daha`);

  console.log(`\n=== randevular.csv'DE VAR AMA YENİ DB'DE 'ESKİ ÜYE' OLARAK KAYITLI (${foundButDeleted.length} adet) ===`);
  foundButDeleted.forEach(n => {
    const r = dbByName.get(n);
    console.log(`  ${n} (id:${r.id})`);
  });

  await client.end();
}

main().catch(console.error);
