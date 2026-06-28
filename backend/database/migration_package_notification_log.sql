-- Paket bildirim log tablosu
-- Aynı tip bildirimin aynı pakete tekrar tekrar gönderilmesini önler.
-- type: 'session_low' (seans %25 altına düştü) | 'expiry_warning' (süre %25 altına düştü)
-- 7 günlük cooldown kodu tarafından kontrol edilir (sent_at > NOW() - INTERVAL '7 days').
CREATE TABLE IF NOT EXISTS package_notification_log (
  id                 SERIAL PRIMARY KEY,
  member_package_id  INTEGER      NOT NULL REFERENCES member_packages(id) ON DELETE CASCADE,
  type               VARCHAR(50)  NOT NULL,
  sent_at            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pkg_notif_log_mpid ON package_notification_log (member_package_id);
CREATE INDEX IF NOT EXISTS idx_pkg_notif_log_sent ON package_notification_log (sent_at);
