-- Uygulama ayarları (kurum WhatsApp vb.)
-- Çalıştırma: cd backend && npm run migrate:run -- migration_app_settings.sql

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE app_settings IS 'Anahtar-değer uygulama ayarları';
COMMENT ON COLUMN app_settings.key IS 'Ayar anahtarı (örn. institution_whatsapp)';
