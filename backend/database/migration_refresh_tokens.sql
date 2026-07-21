-- Refresh token tablosu — "Beni hatırla" oturumlarında sessiz token yenileme için.
-- Access token kısa ömürlü kalır; refresh token (hash'lenmiş) ile mobil uygulama
-- kullanıcı çıkış yapana kadar oturumu açık tutar. Süre kayan (sliding): her
-- kullanımda uzatılır.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,          -- ham token değil, SHA-256 hash'i saklanır
    remember_me BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
