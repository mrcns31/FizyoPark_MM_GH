import pkg from 'pg';
const { Pool, types } = pkg;

// DATE sütunlarını JS Date'e çevirme — timezone kaymasını önler
types.setTypeParser(1082, val => val);

// TIMESTAMP WITHOUT TIMEZONE (OID 1114) — oturum timezone'u Europe/Istanbul olduğundan
// bu sütunlara CURRENT_TIMESTAMP İstanbul yerel saatiyle yazılır.
// pg kütüphanesi string'i UTC olarak parse eder → browser'da +3 saat hatalı görünür.
// Çözüm: parse sırasında +03:00 offseti ekleyerek doğru UTC epoch'u üretiriz.
types.setTypeParser(1114, (val) => {
  if (!val) return null;
  return new Date(val.replace(' ', 'T') + '+03:00');
});
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
