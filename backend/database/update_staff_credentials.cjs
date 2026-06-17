const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function main() {
  const pg = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
  await pg.connect();

  const staff = await pg.query(`SELECT u.id, u.phone FROM users u JOIN staff s ON s.user_id = u.id WHERE u.role = 'staff'`);

  for (const row of staff.rows) {
    const phone = row.phone;
    const email = `${phone}@fizyopark.com`;
    const password = phone.slice(-4);
    const hash = await bcrypt.hash(password, 12);

    await pg.query(
      `UPDATE users SET email = $1, username = $1, password_hash = $2 WHERE id = $3`,
      [email, hash, row.id]
    );

    const name = await pg.query(`SELECT display_name FROM users WHERE id = $1`, [row.id]);
    console.log(`✓ ${name.rows[0].display_name} → ${email} / şifre: ${password}`);
  }

  await pg.end();
}

main().catch(console.error);
