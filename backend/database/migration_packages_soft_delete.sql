-- packages tablosuna soft delete desteği ekle
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_packages_soft_delete.sql

ALTER TABLE packages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

COMMENT ON COLUMN packages.deleted_at IS 'Soft delete: NULL = aktif, dolu = pasife alınmış (eski üye paketleri korunur)';
