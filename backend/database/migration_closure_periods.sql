-- Tatil/kapanış günleri: admin tarafından işaretlenen, işyerinin kapalı olduğu tarih aralıkları.
-- Çalıştırma: cd backend && npm run migrate:run -- migration_closure_periods.sql

CREATE TABLE IF NOT EXISTS closure_periods (
    id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT closure_periods_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_closure_periods_start_date ON closure_periods (start_date DESC);

COMMENT ON TABLE closure_periods IS 'Admin tarafından işaretlenen kapanış (tatil) tarih aralıkları; kayıt anında seans kaydırma ve paket süresi uzatma uygulanır.';
