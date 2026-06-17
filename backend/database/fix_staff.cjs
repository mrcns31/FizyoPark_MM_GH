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

const STAFF = [
  { first_name: 'Şerife',      last_name: 'Akgül',     phone: '05061593767' },
  { first_name: 'Arzum',       last_name: 'Çınar',     phone: '05325468436' },
  { first_name: 'Damla',       last_name: 'Durgun',    phone: '05331441703' },
  { first_name: 'Cansu',       last_name: 'Mullaoğlu', phone: '05308133360' },
  { first_name: 'Melis Gözde', last_name: 'Yıldırım',  phone: '05443741972' },
];

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  for (const s of STAFF) {
    const phone = normalizePhone(s.phone);
    await client.query(
      'UPDATE staff SET phone = $1 WHERE first_name = $2 AND last_name = $3',
      [phone, s.first_name, s.last_name]
    );
    console.log(`${s.first_name} ${s.last_name} → ${phone}`);
  }

  await client.end();
}

main().catch(console.error);
