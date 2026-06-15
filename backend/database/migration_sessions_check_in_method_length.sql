-- check_in_method VARCHAR(10) yönetici onayını (admin) engelliyordu; genişlet
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_sessions_check_in_method_length.sql

ALTER TABLE sessions
  ALTER COLUMN check_in_method TYPE VARCHAR(20);

COMMENT ON COLUMN sessions.check_in_method IS 'qr | manual | admin — kapı QR, personel veya yönetici onayı';
