const bcrypt = require('bcryptjs');
const { Client } = require('pg');
async function main() {
  const hash = await bcrypt.hash('123456', 12);
  const pg = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
  await pg.connect();
  const r = await pg.query(
    "INSERT INTO users (username, email, password_hash, role, is_active, display_name) VALUES ('fizyoparkankara', 'fizyoparkankara@gmail.com', $1, 'admin', true, 'Admin') RETURNING id, username, email, role",
    [hash]
  );
  console.log('Eklendi:', r.rows[0]);
  await pg.end();
}
main().catch(console.error);
