/**
 * UTC sunucuda oluşturulmuş hatalı seans zaman damgalarını düzeltir.
 *
 * SORUN: Sunucu UTC timezone'dayken oluşturulan seanslar, Turkey saati (UTC+3)
 * yerine UTC saatiyle kaydedildi. Örn: Turkey 08:00 → UTC 08:00 (olması gereken UTC 05:00).
 * Bu seanslarda start_ts/end_ts +3 saat fazla kayıtlı.
 *
 * ÇÖZÜM: Hatalı seansların start_ts ve end_ts değerinden 3 saat (10800000 ms) çıkar.
 *
 * Kullanım: cd backend && node scripts/fix-session-timestamps-utc.js
 *
 * DİKKAT: Bu scripti çalıştırmadan önce veritabanı yedeği alın!
 * Timezone düzeltmesinin uygulandığı tarihi ve saati bilmeniz gerekiyor.
 */

import db from '../config/database.js';

const OFFSET_MS = 3 * 60 * 60 * 1000; // 3 saat = UTC+3

// Timezone düzeltmesinin uygulandığı yaklaşık tarih (git push zamanı)
// Bu tarihi kendi push zamanınıza göre güncelleyin (UTC)
const FIX_APPLIED_BEFORE = process.env.FIX_BEFORE || '2026-06-24 12:00:00';

const dry = process.argv.includes('--dry') || process.argv.includes('--test');
console.log(`Mod: ${dry ? 'DRY-RUN (değişiklik yapılmaz)' : 'CANLI (veritabanı güncellenecek)'}`);
console.log(`Düzeltme öncesi tarih: ${FIX_APPLIED_BEFORE}`);
console.log('---');

// Önce hangi seansların etkileneceğini göster
const preview = await db.query(
  `SELECT
     COUNT(*)::int AS total,
     MIN(to_timestamp(start_ts / 1000.0) AT TIME ZONE 'UTC') AS en_eski,
     MAX(to_timestamp(start_ts / 1000.0) AT TIME ZONE 'UTC') AS en_yeni
   FROM sessions
   WHERE deleted_at IS NULL
     AND created_at < $1::timestamptz`,
  [FIX_APPLIED_BEFORE]
);

const { total, en_eski, en_yeni } = preview.rows[0];
console.log(`Etkilenecek seans sayısı: ${total}`);
console.log(`En eski: ${en_eski}`);
console.log(`En yeni: ${en_yeni}`);

if (total === 0) {
  console.log('Düzeltilecek seans yok. Script sonlandı.');
  process.exit(0);
}

if (dry) {
  console.log('\nDRY-RUN: Değişiklik yapılmadı. Gerçek çalıştırmak için --dry olmadan çalıştırın.');
  process.exit(0);
}

console.log('\nGerçek güncelleme başlıyor...');
const result = await db.query(
  `UPDATE sessions
   SET start_ts = start_ts - $1,
       end_ts   = end_ts   - $1
   WHERE deleted_at IS NULL
     AND created_at < $2::timestamptz`,
  [OFFSET_MS, FIX_APPLIED_BEFORE]
);

console.log(`Güncellendi: ${result.rowCount} seans`);
console.log('Tamamlandı. Takvimi yenileyin ve seansların saatlerini kontrol edin.');

process.exit(0);
