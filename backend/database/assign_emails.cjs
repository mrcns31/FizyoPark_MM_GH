const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  const { rows } = await client.query(
    "SELECT id, member_no, phone FROM members WHERE email IS NULL OR email = ''"
  );

  console.log(`${rows.length} üyenin e-postası yok.`);

  let updated = 0;
  for (const row of rows) {
    let email;
    if (row.phone) {
      const digits = row.phone.replace(/\D/g, '');
      email = `${digits}@fizyopark.com`;
    } else {
      email = `${row.member_no}@fizyopark.com`;
    }

    await client.query('UPDATE members SET email = $1 WHERE id = $2', [email, row.id]);
    updated++;
  }

  await client.end();
  console.log(`${updated} üyeye geçici e-posta atandı.`);
}

main().catch(console.error);
