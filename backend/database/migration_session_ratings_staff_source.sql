-- Puan artık seansın GÜNCEL personeline ve tarihine bağlanır.
--
-- Önceki tasarımda staff_id ve session_start_ts puanlama anında kopyalanıyordu.
-- Ancak seansın sonradan başka personele aktarılması, "bu seansı aslında kim yaptı"
-- bilgisinin düzeltilmesi demektir; puan da düzeltmeyi izlemelidir. İki ayrı kaynak
-- tutmak kaçınılmaz olarak sapmaya yol açtığı için kopyalar kaldırıldı — raporlar
-- sessions tablosuna join ile bakar, tek gerçek kaynak orasıdır.
--
-- Çalıştırma: cd backend && npm run migrate:run -- migration_session_ratings_staff_source.sql

DROP INDEX IF EXISTS idx_session_ratings_staff;

ALTER TABLE session_ratings DROP COLUMN IF EXISTS staff_id;
ALTER TABLE session_ratings DROP COLUMN IF EXISTS session_start_ts;

COMMENT ON TABLE session_ratings IS
  'Üyenin tamamladığı seansa verdiği 1-5 puan (seans başına tek kayıt). Personel ve tarih bilgisi sessions tablosundan okunur.';
