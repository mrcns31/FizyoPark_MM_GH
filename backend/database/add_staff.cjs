const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const STAFF = [
  { username: 'arzumcinar',      firstName: 'Arzum',       lastName: 'Çınar',          email: 'arzumcinar1@gmail.com',       phone: '5325468436' },
  { username: 'cansumullaoglu',  firstName: 'Cansu',       lastName: 'Mullaoğlu',       email: 'cansumullaoglu@gmail.com',    phone: '5308133360' },
  { username: 'damladurgun',     firstName: 'Damla',       lastName: 'Durgun',          email: 'Damladurgun1617@gmail.com',   phone: '5331441703' },
  { username: 'melisgozde',      firstName: 'Melis Gözde', lastName: 'Yıldırım',        email: 'melisgozde9@gmail.com',       phone: '5443741972' },
  { username: 'serifeakgul',     firstName: 'Şerife',      lastName: 'Akgül',           email: 'nurakgul19@gmail.com',        phone: '5061593767' },
];

async function main() {
  const hash = await bcrypt.hash('Fizyopark2026!', 12);
  const pg = new Client({ host: 'localhost', port: 5432, database: 'fizyopark_mm_gh', user: 'postgres', password: '' });
  await pg.connect();

  for (const s of STAFF) {
    const fullName = `${s.firstName} ${s.lastName}`;
    const uRes = await pg.query(
      `INSERT INTO users (username, email, password_hash, role, is_active, display_name, phone)
       VALUES ($1, $2, $3, 'staff', true, $4, $5)
       ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name, phone = EXCLUDED.phone
       RETURNING id`,
      [s.username, s.email.toLowerCase(), hash, fullName, s.phone]
    );
    const userId = uRes.rows[0].id;

    await pg.query(
      `INSERT INTO staff (user_id, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4)`,
      [userId, s.firstName, s.lastName, s.phone]
    );

    console.log(`✓ ${fullName} eklendi (user_id=${userId})`);
  }

  await pg.end();
  console.log('\nTüm personeller eklendi. Default şifre: Fizyopark2026!');
}

main().catch(console.error);
