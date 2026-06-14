-- KVKK / Gizlilik Politikası onay kayıtları (audit trail)
-- Çalıştırma: cd backend && npm run migrate:run -- migration_user_consents.sql

CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_version VARCHAR(20) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_version
  ON user_consents (user_id, consent_version);

COMMENT ON TABLE user_consents IS 'KVKK / Gizlilik Politikası onay kayıtları (audit trail, üzerine yazılmaz)';
