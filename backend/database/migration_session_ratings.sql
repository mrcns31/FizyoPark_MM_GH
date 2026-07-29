-- Üye seans puanlaması (1-5) — personel performans analizi için
-- Çalıştırma: cd backend && npm run migrate:run -- migration_session_ratings.sql

CREATE TABLE IF NOT EXISTS session_ratings (
    id SERIAL PRIMARY KEY,
    session_id       INTEGER NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    member_id        INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    staff_id         INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    session_start_ts BIGINT NOT NULL,
    rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment          TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_ratings_staff ON session_ratings(staff_id, session_start_ts);
CREATE INDEX IF NOT EXISTS idx_session_ratings_member ON session_ratings(member_id);

COMMENT ON TABLE session_ratings IS 'Üyenin tamamladığı seansa verdiği 1-5 puan (seans başına tek kayıt)';
COMMENT ON COLUMN session_ratings.staff_id IS 'Puanlama anındaki personel (snapshot) — seans sonradan devredilirse puan doğru kişide kalır';
COMMENT ON COLUMN session_ratings.session_start_ts IS 'Aylık gruplama, puanın verildiği aya değil seansın yapıldığı aya göre yapılır';
COMMENT ON COLUMN session_ratings.comment IS 'Opsiyonel yorum — yalnızca admin/manager görebilir, personele gösterilmez';

-- Puanlama sisteminin devreye alındığı an: 1 Ağustos 2026, 00:00 (Europe/Istanbul).
-- Bu tarihten önce biten seanslar puanlanamaz; aksi halde sistem açıldığında
-- üyenin karşısına aylar öncesinin seansları dökülür.
-- Sabit tarih kullanılır (NOW() değil) ki migration hangi an çalışırsa çalışsın
-- devreye alma tarihi kaymasın; migration tekrar çalışırsa da aynı değere döner.
INSERT INTO app_settings (key, value)
VALUES ('ratings_go_live_ts', (EXTRACT(EPOCH FROM TIMESTAMPTZ '2026-08-01 00:00:00+03') * 1000)::BIGINT::TEXT)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
