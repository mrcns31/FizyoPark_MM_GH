const { Client } = require('pg');

const DB_CONFIG = {
  host: 'localhost', port: 5432,
  database: 'fizyopark_mm_gh', user: 'postgres', password: ''
};

function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6,8)}-${digits.slice(8,10)}`;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  const { rows } = await client.query('SELECT id, phone, contact_phone FROM members');
  let updated = 0;

  for (const row of rows) {
    const phone = normalizePhone(row.phone);
    const contact_phone = normalizePhone(row.contact_phone);

    if (phone !== row.phone || contact_phone !== row.contact_phone) {
      await client.query(
        'UPDATE members SET phone = $1, contact_phone = $2 WHERE id = $3',
        [phone, contact_phone, row.id]
      );
      updated++;
    }
  }

  await client.end();
  console.log(`${updated} üyenin telefonu düzeltildi.`);
}

main().catch(console.error);
