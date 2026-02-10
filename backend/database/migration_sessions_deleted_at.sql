-- Seans soft delete: silinen seanslar veritabanında kalır, log için deleted_at/deleted_by
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_sessions_deleted_at.sql

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at);

COMMENT ON COLUMN sessions.deleted_at IS 'Dolu ise seans silindi; listelerde gösterilmez, log için saklanır.';
COMMENT ON COLUMN sessions.deleted_by IS 'Seansı silen kullanıcı (user_id); ileride log için.';
