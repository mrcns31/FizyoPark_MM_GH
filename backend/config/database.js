import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'session_tracker',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maksimum bağlantı sayısı
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Bağlantı testi
pool.on('connect', () => {
  console.log('✅ Veritabanına bağlandı');
});

pool.on('error', (err) => {
  console.error('❌ Veritabanı hatası:', err);
});

export default {
  query: (text, params) => pool.query(text, params),
  pool
};
