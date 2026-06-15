-- Üye paket talepleri (aktif paketi biten üyeler admin'e paket ister)
-- Çalıştırma: cd backend && npm run migrate:run -- migration_package_requests.sql

CREATE TABLE IF NOT EXISTS package_requests (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    admin_seen_at TIMESTAMP,
    handled_at TIMESTAMP,
    handled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    member_package_id INTEGER REFERENCES member_packages(id) ON DELETE SET NULL,
    CONSTRAINT package_requests_status_check CHECK (status IN ('pending', 'fulfilled', 'dismissed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_requests_one_pending_per_member
  ON package_requests (member_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_package_requests_status ON package_requests (status);
CREATE INDEX IF NOT EXISTS idx_package_requests_requested_at ON package_requests (requested_at DESC);

COMMENT ON TABLE package_requests IS 'Üyelerin yeni paket talepleri; admin Paket Talepleri panelinden işler.';
