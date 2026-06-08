-- Üye giriş hesapları: members.user_id + users.role 'member'

-- role kısıtına 'member' ekle
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'staff', 'member'));

-- Üye–kullanıcı bağlantısı
ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
