-- Üye silmede "kalıcı" seçeneği: kayıt veritabanında kalır ama hiçbir ekranda görünmez.
-- deleted_at  = soft delete → üye "Eski Üyeler"de görünür, geçmiş seansları takvimde kalır
-- purged_at   = kalıcı gizleme → ne takvimde ne "Eski Üyeler"de görünür, geri açılamaz
-- Çalıştırma: psql -U postgres -h 127.0.0.1 -d <veritabanı_adı> -f backend/database/migration_members_purged_at.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS purged_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_members_purged_at
  ON members(purged_at)
  WHERE purged_at IS NOT NULL;

COMMENT ON COLUMN members.purged_at IS 'Kalıcı silme işareti: kayıt log/geçmiş bütünlüğü için DB''de kalır, hiçbir listede görünmez ve yeniden aktif edilemez';
