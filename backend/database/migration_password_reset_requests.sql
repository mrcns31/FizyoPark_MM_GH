-- Şifre sıfırlama talepleri: kullanıcı login ekranından talep oluşturur,
-- admin talepler panelinde görür ve şifreyi sıfırlayarak talebi kapatır.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  handled_at TIMESTAMP,
  handled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests (status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON password_reset_requests (email);
