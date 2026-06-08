-- Personel ilk girişte şifre belirleme bayrağı
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.must_change_password IS 'true ise kullanıcı bir sonraki girişte kendi şifresini belirlemeli';
