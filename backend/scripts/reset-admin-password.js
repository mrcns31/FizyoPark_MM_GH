/**
 * Admin şifresini sıfırlar (unutulan şifre kurtarma).
 * Çalıştırma: cd backend && node scripts/reset-admin-password.js
 * Opsiyonel: RESET_ADMIN_PASSWORD=yeniSifre node scripts/reset-admin-password.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'fizyopark_mm_gh',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const NEW_PASSWORD = process.env.RESET_ADMIN_PASSWORD || 'admin123';

async function reset() {
  const client = await pool.connect();
  try {
    const adminRes = await client.query(
      `SELECT id, username, email FROM users WHERE role = 'admin' AND is_active = true ORDER BY id LIMIT 1`
    );
    if (adminRes.rows.length === 0) {
      console.error('Aktif admin hesabı bulunamadı. Önce: npm run seed');
      process.exit(1);
    }

    const admin = adminRes.rows[0];
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hash, admin.id]
    );

    const login = admin.email || admin.username;
    console.log('Admin şifresi sıfırlandı.');
    console.log(`Giriş e-postası: ${login}`);
    console.log(`Yeni şifre: ${NEW_PASSWORD}`);
  } catch (err) {
    console.error('Sıfırlama hatası:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
