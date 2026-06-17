-- Personel soft delete: silinen personel veritabanında kalır, deleted_at dolu ise listede görünmez
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_staff_deleted_at.sql

ALTER TABLE staff ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_staff_deleted_at ON staff(deleted_at);

COMMENT ON COLUMN staff.deleted_at IS 'Dolu ise personel soft-silindi; listelerde gösterilmez, eski paket/seans referansları korunur.';
