-- Üye hesap silme / üyelik iptal talebi
-- Çalıştırma: cd backend && npm run migrate:run -- migration_members_deletion_request.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_members_deletion_requested_at
  ON members(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

COMMENT ON COLUMN members.deletion_requested_at IS 'Üyenin üyelik iptal talebi zamanı; admin onayından sonra soft delete uygulanır.';
