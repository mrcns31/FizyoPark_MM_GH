const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
c.connect().then(async () => {
  const r1 = await c.query(`
    SELECT mp.id, mp.status, mp.start_date, mp.end_date, p.name, p.lesson_count
    FROM member_packages mp JOIN packages p ON p.id = mp.package_id
    WHERE mp.member_id = 48 ORDER BY mp.start_date DESC
  `);
  console.log('Burcu Bilgin (id:48) paketleri:');
  r1.rows.forEach(r => console.log(JSON.stringify(r)));

  const r2 = await c.query(`SELECT COUNT(*) FROM sessions WHERE member_id = 48`);
  console.log('Burcu seansları:', r2.rows[0].count);

  const r3 = await c.query(`
    SELECT mp.id, mp.status, mp.start_date, mp.end_date, p.name, p.lesson_count
    FROM member_packages mp JOIN packages p ON p.id = mp.package_id
    WHERE mp.member_id = 49 ORDER BY mp.start_date DESC
  `);
  console.log('İpek Bilgin (id:49) paketleri:');
  r3.rows.forEach(r => console.log(JSON.stringify(r)));

  const r4 = await c.query(`SELECT COUNT(*) FROM sessions WHERE member_id = 49`);
  console.log('İpek seansları:', r4.rows[0].count);

  // CSV'de bugün 11:00 Bilgin seansları
  const fs = require('fs');
  const csv = fs.readFileSync('D:\\26-01-2026-Cursor-Takip\\randevular.csv', 'utf-8');
  const today = csv.split('\n').filter(l => l.toLowerCase().includes('bilgin') && l.includes('2026-06-16'));
  console.log('\nBugün (2026-06-16) Bilgin seansları CSV:');
  today.forEach(l => console.log(l));

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
