-- Toplu push bildirimleri gönderim kaydı
CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY,
    sent_by_user_id INTEGER NOT NULL REFERENCES users(id),
    sent_by_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    total_selected INTEGER NOT NULL DEFAULT 0,   -- seçilen üye sayısı
    total_sent INTEGER NOT NULL DEFAULT 0,        -- token'ı olan → push gönderilen
    total_no_token INTEGER NOT NULL DEFAULT 0,    -- uygulaması/izni olmayan
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hangi üyelere gönderildiği (seçilenler)
CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id SERIAL PRIMARY KEY,
    broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL,
    member_name VARCHAR(255),
    has_token BOOLEAN NOT NULL DEFAULT FALSE,     -- push gönderilebildi mi
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_id ON broadcast_recipients(broadcast_id);
