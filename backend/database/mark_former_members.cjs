const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  // Paketi olmayan ve silinmemiş üyeler → eski üye olarak işaretle
  const res = await client.query(`
    UPDATE members
    SET deleted_at = '2024-01-01 00:00:00'
    WHERE deleted_at IS NULL
      AND id NOT IN (SELECT DISTINCT member_id FROM member_packages)
    RETURNING id
  `);

  await client.end();
  console.log(`${res.rowCount} üye "Eski Üyeler" listesine taşındı.`);
}

main().catch(console.error);
