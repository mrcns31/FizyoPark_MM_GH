-- packages tablosuna üye görünürlüğü desteği ekle
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_packages_member_visible.sql

ALTER TABLE packages ADD COLUMN IF NOT EXISTS member_visible BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN packages.member_visible IS 'false = üye self-servis portalında (paket talebi kataloğunda) gösterilmez';
