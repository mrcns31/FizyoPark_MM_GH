const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function fix() {
  const hash = await bcrypt.hash('Fizyopark2026!', 12);
  const pg = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
  await pg.connect();
  await pg.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
  const r = await pg.query("SELECT length(password_hash) as len FROM users WHERE username='admin'");
  console.log('Hash uzunlugu:', r.rows[0].len, '(60 olmali)');
  await pg.end();
  console.log('Guncellendi - admin@fizyopark.com / Fizyopark2026!');
}
fix().catch(console.error);
