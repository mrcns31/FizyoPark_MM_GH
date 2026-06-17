const { Client } = require('pg');
async function fix() {
  const pg = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
  await pg.connect();
  const r = await pg.query("UPDATE users SET role = 'admin' WHERE username = 'admin' RETURNING username, email, role");
  console.log('Guncellendi:', r.rows[0]);
  await pg.end();
}
fix().catch(console.error);
