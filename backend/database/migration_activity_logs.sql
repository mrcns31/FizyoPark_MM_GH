-- İşlem logları (audit log) tablosu
-- Kim, ne işlemi, ne zaman, hangi varlık üzerinde yaptı – ileride personel girişi ve sorun takibi için

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    -- Kim yaptı (ileride personel girişi ile doldurulacak)
    actor_type VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'anonymous')),
    actor_id INTEGER NULL,                    -- users.id (giriş yapan kullanıcı)
    actor_name VARCHAR(255) NULL,            -- Görüntüleme için: "Ahmet Yılmaz" veya "sistem"
    -- Ne yapıldı
    action VARCHAR(100) NOT NULL,            -- Örn: member.create, session.delete, auth.login
    entity_type VARCHAR(50) NULL,           -- Örn: member, session, room, staff, package
    entity_id VARCHAR(50) NULL,             -- İlgili kaydın id'si (farklı tablolar için string)
    -- Detay (eski/yeni değerler, ek bilgi – JSON)
    details JSONB DEFAULT '{}',
    -- İstek bilgisi (opsiyonel; güvenlik / IP takibi için)
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    --
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

COMMENT ON TABLE activity_logs IS 'Tüm önemli işlemlerin audit kaydı; kim, ne, ne zaman.';
COMMENT ON COLUMN activity_logs.actor_type IS 'user: giriş yapmış kullanıcı, system: otomatik işlem, anonymous: token yok';
COMMENT ON COLUMN activity_logs.action IS 'Örnek: member.create, session.update, auth.login_failed';
