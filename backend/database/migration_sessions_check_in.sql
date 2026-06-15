-- Seans QR girişi: kapı okuyucu doğrulamasında işaretlenir; paket hakkından düşüm buna göre yapılır.
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_sessions_check_in.sql

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sessions_checked_in_at ON sessions(checked_in_at);

COMMENT ON COLUMN sessions.checked_in_at IS 'Üye randevu günü QR ile kapıdan giriş yaptığında dolar; paket hakkı düşümü için kullanılır.';