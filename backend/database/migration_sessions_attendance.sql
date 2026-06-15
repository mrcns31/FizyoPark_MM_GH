-- Personel giriş onayı (QR okutmayan üyeler) + personel bildirimleri
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_sessions_attendance.sql

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS check_in_method VARCHAR(20);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_outcome VARCHAR(20);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_confirmed_at TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_confirmed_by INTEGER REFERENCES users(id);

COMMENT ON COLUMN sessions.check_in_method IS 'qr | manual | admin — kapı QR, personel veya yönetici onayı';
COMMENT ON COLUMN sessions.attendance_outcome IS 'present | no_show — personel onay sonucu (QR için checked_in_at yeterli)';
COMMENT ON COLUMN sessions.attendance_confirmed_at IS 'Personelin geldi/gelmedi onay zamanı';
COMMENT ON COLUMN sessions.attendance_confirmed_by IS 'Onaylayan kullanıcı (users.id)';

CREATE INDEX IF NOT EXISTS idx_sessions_attendance_pending
  ON sessions (staff_id, start_ts)
  WHERE deleted_at IS NULL
    AND checked_in_at IS NULL
    AND attendance_confirmed_at IS NULL
    AND member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    payload JSONB DEFAULT '{}',
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user_unread
  ON staff_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
