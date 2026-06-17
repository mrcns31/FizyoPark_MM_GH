const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
c.connect().then(async () => {
  // Örnek: ilk 5 eski üye + paketleri
  const r = await c.query(`
    SELECT m.id, m.name, m.deleted_at, mp.id as pkg_id, mp.status, mp.start_date, mp.end_date
    FROM members m
    JOIN member_packages mp ON mp.member_id = m.id
    WHERE mp.status = 'completed'
      AND m.deleted_at IS NULL
    ORDER BY m.name
    LIMIT 5
  `);
  console.log('Örnek eski üyeler:');
  r.rows.forEach(row => console.log(JSON.stringify(row)));

  // /member-packages endpoint'inin JOIN koşulunu simüle et
  const r2 = await c.query(`
    SELECT COUNT(*) as adet
    FROM member_packages mp
    JOIN packages p ON p.id = mp.package_id
    JOIN members m ON m.id = mp.member_id AND (m.deleted_at IS NULL)
    WHERE mp.status = 'completed'
  `);
  console.log('\nAPI /member-packages endpoint completed sayısı:', r2.rows[0].adet);

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
