import pkg from 'pg';
const { Pool, types } = pkg;

// DATE sütunlarını JS Date'e çevirme — timezone kaymasını önler
types.setTypeParser(1082, val => val);
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

let dbConnectLogged = false;
pool.on('connect', (client) => {
  client.query("SET timezone = 'Europe/Istanbul'");
  if (!dbConnectLogged) {
    console.log('✅ Veritabanına bağlandı');
    dbConnectLogged = true;
  }
});

pool.on('error', (err) => {
  console.error('❌ Veritabanı hatası:', err);
});

export default {
  query: (text, params) => pool.query(text, params),
  pool
};
