-- Randevusuz kapı QR girişleri (verify-access, uygun seans yokken)
CREATE TABLE IF NOT EXISTS facility_access_logs (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(20) NOT NULL DEFAULT 'qr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facility_access_logs_member_id ON facility_access_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_facility_access_logs_accessed_at ON facility_access_logs(accessed_at);
