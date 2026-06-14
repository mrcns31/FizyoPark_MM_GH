/**
 * applyClosurePeriod için doğrulama scripti.
 *
 * Not: cancelPackageSessionsAtSlot -> addNextSessionAfterLastForPackage ->
 * placeSessionWithRebalance, kendi iç transaction'ı için `db.pool.connect()`
 * kullanır (bkz. utils/sessionSlot.js). Bu yüzden applyClosurePeriod'u dışarıdan
 * tek bir BEGIN/ROLLBACK transaction client'ı ile sarmak mümkün değil; gerçek
 * `db` nesnesi (db.pool içeren) ile çağrılmalıdır — tıpkı routes/sessions.js ve
 * routes/member-portal.js'deki cancelPackageSessionsAtSlot kullanımı gibi.
 *
 * Bu script:
 *  1) Çok ileri bir tarihte (bugünden +400 gün), o aralıkta hiç seans
 *     olmadığından emin olunan 2 günlük bir kapanış dönemi uygular
 *     (rescheduledCount/cancelledOnlyCount = 0 bekleniyor, yan etkisi yok).
 *  2) extendedPackageCount ve end_date uzatmalarını doğrular.
 *  3) Sonunda eklenen closure_periods kaydını siler ve member_packages
 *     end_date değerlerini orijinaline geri döndürerek veritabanını
 *     başlangıç durumuna getirir (BEGIN/COMMIT ile tek transaction).
 *
 * Kullanım: cd backend && node scripts/test-closure-periods.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { applyClosurePeriod, dayCountInclusive, deleteClosurePeriod } from '../utils/closurePeriods.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function run() {
  let failed = false;
  let closurePeriodId = null;
  let beforeRows = [];

  try {
    // Çok ileri bir tarih: mevcut seans planlama ufkunun (genelde paket süresi ~birkaç ay)
    // ötesinde olacak şekilde +400 gün seçiliyor, böylece aralıkta seans olmaz.
    const startDate = addDaysToDateStr(new Date().toISOString().slice(0, 10), 400);
    const endDate = addDaysToDateStr(startDate, 1);
    const dayCount = dayCountInclusive(startDate, endDate);
    console.log(`Test aralığı: ${startDate} -> ${endDate} (dayCount=${dayCount})`);

    const rangeStart = new Date(`${startDate}T00:00:00`).getTime();
    const rangeEnd = new Date(`${endDate}T23:59:59.999`).getTime();
    const preCheck = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM sessions
       WHERE deleted_at IS NULL AND start_ts >= $1 AND start_ts <= $2`,
      [rangeStart, rangeEnd]
    );
    if (preCheck.rows[0].cnt !== 0) {
      console.error(`HATA: test aralığında zaten ${preCheck.rows[0].cnt} seans var, daha ileri bir tarih seçilmeli.`);
      process.exitCode = 1;
      return;
    }

    const before = await db.query(
      `SELECT id, end_date FROM member_packages WHERE status = 'active' ORDER BY id`
    );
    beforeRows = before.rows;
    console.log(`Aktif paket sayısı: ${beforeRows.length}`);

    const result = await applyClosurePeriod(db, {
      startDate,
      endDate,
      description: 'Test kapanışı (otomatik doğrulama)',
      createdBy: null,
    });
    closurePeriodId = result.closurePeriod.id;
    console.log('applyClosurePeriod sonucu:', JSON.stringify(result, null, 2));

    if (result.closurePeriod.startDate !== startDate) {
      console.error(`HATA: closurePeriod.startDate beklenen ${startDate}, dönen ${result.closurePeriod.startDate}`);
      failed = true;
    }
    if (result.closurePeriod.endDate !== endDate) {
      console.error(`HATA: closurePeriod.endDate beklenen ${endDate}, dönen ${result.closurePeriod.endDate}`);
      failed = true;
    }

    if (result.summary.dayCount !== dayCount) {
      console.error(`HATA: dayCount beklenen ${dayCount}, dönen ${result.summary.dayCount}`);
      failed = true;
    }
    if (result.summary.extendedPackageCount !== beforeRows.length) {
      console.error(`HATA: extendedPackageCount beklenen ${beforeRows.length}, dönen ${result.summary.extendedPackageCount}`);
      failed = true;
    }
    if (result.summary.rescheduledCount !== 0 || result.summary.cancelledOnlyCount !== 0) {
      console.error(`HATA: bu aralıkta seans olmamalıydı; rescheduledCount=${result.summary.rescheduledCount}, cancelledOnlyCount=${result.summary.cancelledOnlyCount}`);
      failed = true;
    }

    const after = await db.query(
      `SELECT id, end_date FROM member_packages WHERE id = ANY($1::int[]) ORDER BY id`,
      [beforeRows.map((r) => r.id)]
    );
    for (let i = 0; i < beforeRows.length; i++) {
      const beforeEnd = new Date(beforeRows[i].end_date).getTime();
      const afterEnd = new Date(after.rows[i].end_date).getTime();
      const diffDays = Math.round((afterEnd - beforeEnd) / 86400000);
      if (diffDays !== dayCount) {
        console.error(`HATA: paket ${beforeRows[i].id} end_date ${diffDays} gün arttı, beklenen ${dayCount}`);
        failed = true;
      }
    }
  } catch (err) {
    console.error('❌ Script hatası:', err);
    failed = true;
    process.exitCode = 1;
  }

  // Temizlik: eklenen closure_periods kaydını sil ve end_date uzatmalarını geri al.
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (closurePeriodId != null) {
      const del = await deleteClosurePeriod(client, closurePeriodId);
      if (!del) {
        console.error(`HATA: closure_periods id=${closurePeriodId} silinemedi.`);
        failed = true;
      }
    }
    for (const row of beforeRows) {
      await client.query(
        `UPDATE member_packages SET end_date = $2 WHERE id = $1`,
        [row.id, row.end_date]
      );
    }
    await client.query('COMMIT');
    console.log('Temizlik tamamlandı: closure_periods kaydı silindi, end_date değerleri geri alındı.');
  } catch (cleanupErr) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Temizlik hatası:', cleanupErr);
    failed = true;
    process.exitCode = 1;
  } finally {
    client.release();
  }

  if (failed) {
    console.error('❌ Doğrulama başarısız.');
    if (!process.exitCode) process.exitCode = 1;
  } else {
    console.log('✅ Doğrulama başarılı.');
  }

  await db.pool.end();
}

run();
