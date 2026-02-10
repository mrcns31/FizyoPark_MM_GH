-- Üye soft delete: silindi işaretleme (sistemde görünmez, veritabanında kalır)
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_members_deleted_at.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_members_deleted_at ON members(deleted_at);

COMMENT ON COLUMN members.deleted_at IS 'Dolu ise üye soft-silindi; listelerde gösterilmez.';
