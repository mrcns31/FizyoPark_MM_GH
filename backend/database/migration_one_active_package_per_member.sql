-- Her üye aynı anda yalnızca 1 aktif paket alabilir (veritabanı güvencesi)
-- İkinci bir aktif paket eklenmeye çalışılırsa unique ihlali oluşur.
--
-- Çalıştırma (backend/.env kullanılır, kullanıcı/şifre elle yazılmaz):
--   cd backend && npm run migrate
--
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_packages_one_active_per_member
  ON member_packages (member_id)
  WHERE status = 'active';
