/**
 * Migration SQL dosyasını projenin .env ayarlarıyla çalıştırır.
 * Kullanım: cd backend && node scripts/run-migration.js [dosya_adı.sql]
 * Örnek:   node scripts/run-migration.js migration_one_active_package_per_member.sql
 * Dosya adı verilmezse: migration_one_active_package_per_member.sql çalıştırılır.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'session_tracker',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DB_DIR = path.join(__dirname, '../database');

async function run() {
  const fileName = process.argv[2] || 'migration_one_active_package_per_member.sql';
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(DB_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.error('Dosya bulunamadı:', filePath);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query(sql);
    console.log('✅ Migration tamamlandı:', fileName);
  } catch (err) {
    console.error('❌ Migration hatası:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
