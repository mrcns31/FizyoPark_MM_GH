const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
c.connect().then(async () => {
  // Paketi completed olan ve deleted_at NULL olan üye sayısı
  const r1 = await c.query(`
    SELECT COUNT(DISTINCT m.id) AS adet
    FROM members m
    JOIN member_packages mp ON mp.member_id = m.id
    WHERE mp.status = 'completed'
      AND m.deleted_at IS NULL
  `);
  console.log('completed paketli + deleted_at NULL üye:', r1.rows[0].adet);

  // Paketi olmayan ve deleted_at NULL olan üye sayısı
  const r2 = await c.query(`
    SELECT COUNT(*) AS adet FROM members
    WHERE deleted_at IS NULL
      AND id NOT IN (SELECT DISTINCT member_id FROM member_packages)
  `);
  console.log('Paketsiz + deleted_at NULL üye:', r2.rows[0].adet);

  // member_packages toplam
  const r3 = await c.query('SELECT COUNT(*) AS adet FROM member_packages');
  console.log('Toplam member_packages:', r3.rows[0].adet);

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
