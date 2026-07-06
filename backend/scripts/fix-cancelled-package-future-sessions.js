/**
 * "Paketi Bitmiş"/"cancelled" durumuna alınmış üye paketlerinin, o tarihten SONRAKİ
 * seanslarını iptal eder (soft-delete). PUT /member-packages/:id endpoint'i bu temizliği
 * yalnızca bu düzeltmeden sonra otomatik yapıyor; bu script önceden bu yoldan
 * sonlandırılmış paketlerde takvimde kalan "hayalet" randevuları bir kerelik temizler.
 * Kullanım: cd backend && node scripts/fix-cancelled-package-future-sessions.js
 */
import db from '../config/database.js';

const packages = await db.query(`
  SELECT id, end_date, updated_at
  FROM member_packages
  WHERE status IN ('completed', 'cancelled')
`);

let totalCleaned = 0;

for (const mp of packages.rows) {
  const cutoffMs = mp.end_date
    ? new Date(String(mp.end_date).slice(0, 10) + 'T00:00:00').getTime()
    : new Date(mp.updated_at).getTime();

  const result = await db.query(
    `UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP
     WHERE member_package_id = $1 AND start_ts >= $2 AND deleted_at IS NULL
     RETURNING id`,
    [mp.id, cutoffMs]
  );

  if (result.rows.length > 0) {
    totalCleaned += result.rows.length;
    console.log(`member_package ${mp.id}: ${result.rows.length} seans iptal edildi (cutoff: ${new Date(cutoffMs).toISOString()})`);
  }
}

console.log(`Toplam ${totalCleaned} seans temizlendi.`);
process.exit(0);
