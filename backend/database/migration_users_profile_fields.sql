-- Kullanıcı profil alanları (admin / hesap güncelleme)
-- Çalıştırma: cd backend && npm run migrate:run -- migration_users_profile_fields.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);

COMMENT ON COLUMN users.display_name IS 'Görünen ad soyad (özellikle admin hesabı)';
COMMENT ON COLUMN users.phone IS 'Kullanıcı telefon numarası';
