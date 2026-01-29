/**
 * İlk admin kullanıcı ve varsayılan çalışma saatlerini oluşturur.
 * Çalıştırma: cd backend && node scripts/seed-admin.js
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

const ADMIN_PASSWORD = 'admin123';

async function seed() {
  const client = await pool.connect();
  try {
    // Admin kullanıcı var mı?
    const userCheck = await client.query(
      "SELECT id FROM users WHERE username = 'admin'"
    );
    if (userCheck.rows.length > 0) {
      console.log('Admin kullanıcı zaten var. Şifre güncellemek için önce users tablosundan admin silin.');
      return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ('admin', 'admin@local', $1, 'admin')`,
      [hash]
    );
    console.log('Admin kullanıcı oluşturuldu: username=admin, password=admin123');

    // working_hours boşsa varsayılanları ekle
    const whCheck = await client.query('SELECT COUNT(*) FROM working_hours');
    if (parseInt(whCheck.rows[0].count) === 0) {
      const days = [
        [0, false, '08:00', '20:00'],
        [1, true, '08:00', '20:00'],
        [2, true, '08:00', '20:00'],
        [3, true, '08:00', '20:00'],
        [4, true, '08:00', '20:00'],
        [5, true, '08:00', '20:00'],
        [6, true, '08:00', '20:00'],
      ];
      for (const [dow, enabled, start, end] of days) {
        await client.query(
          `INSERT INTO working_hours (day_of_week, enabled, start_time, end_time)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (day_of_week) DO NOTHING`,
          [dow, enabled, start, end]
        );
      }
      console.log('Varsayılan çalışma saatleri eklendi.');
    }
  } catch (err) {
    console.error('Seed hatası:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
