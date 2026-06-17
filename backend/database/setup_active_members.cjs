const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

function phoneLast4(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? digits.slice(-4) : null;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  const { rows: members } = await client.query(`
    SELECT DISTINCT m.id, m.member_no, m.email, m.phone, m.user_id
    FROM members m
    INNER JOIN member_packages mp ON mp.member_id = m.id
    WHERE mp.status = 'active'
  `);

  console.log(`${members.length} aktif üye bulundu.`);

  let updated = 0, skipped = 0, errors = 0;

  for (const m of members) {
    const digits = m.phone ? m.phone.replace(/\D/g, '') : null;
    const last4 = digits ? digits.slice(-4) : null;

    if (!digits || digits.length !== 10 || !last4) {
      console.log(`TELEFON YOK: ${m.member_no} — atlandı`);
      skipped++;
      continue;
    }

    const email = `${digits}@fizyopark.com`;

    try {
      await client.query('UPDATE members SET email = $1 WHERE id = $2', [email, m.id]);

      const passwordHash = await bcrypt.hash(last4, 10);

      if (m.user_id) {
        await client.query(
          `UPDATE users SET username = $1, email = $2, password_hash = $3, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
          [email, email, passwordHash, m.user_id]
        );
      } else {
        const dup = await client.query(
          'SELECT id FROM users WHERE username = $1 OR LOWER(email) = LOWER($1)',
          [email]
        );
        if (dup.rows.length > 0) {
          await client.query('UPDATE members SET user_id = $1 WHERE id = $2', [dup.rows[0].id, m.id]);
          await client.query(
            `UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [passwordHash, dup.rows[0].id]
          );
        } else {
          const res = await client.query(
            `INSERT INTO users (username, email, password_hash, role, must_change_password)
             VALUES ($1, $2, $3, 'member', false) RETURNING id`,
            [email, email, passwordHash]
          );
          await client.query('UPDATE members SET user_id = $1 WHERE id = $2', [res.rows[0].id, m.id]);
        }
      }

      updated++;
    } catch (e) {
      console.error(`HATA [${m.member_no}]: ${e.message}`);
      errors++;
    }
  }

  await client.end();
  console.log(`\nTamamlandı: ${updated} üye güncellendi, ${skipped} atlandı, ${errors} hata.`);
}

main().catch(console.error);
