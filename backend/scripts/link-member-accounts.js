/**
 * E-postası olan mevcut üyeler için giriş hesabı oluşturur.
 * Kullanım: cd backend && node scripts/link-member-accounts.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { ensureMemberUserAccount } from '../utils/memberAccount.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const res = await db.query(
    `SELECT id, email, phone, user_id FROM members
     WHERE email IS NOT NULL AND trim(email) != '' AND phone IS NOT NULL`
  );
  let created = 0;
  for (const row of res.rows) {
    if (row.user_id) continue;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await ensureMemberUserAccount(client, row);
      await client.query('COMMIT');
      created++;
      console.log('Hesap oluşturuldu:', row.email);
    } catch (e) {
      await client.query('ROLLBACK');
      console.warn('Atlandı', row.email, '-', e.message);
    } finally {
      client.release();
    }
  }
  console.log('Toplam yeni hesap:', created);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
