/**
 * Seans puanlama kuralları — üye portalı, rapor ve bildirim işleri bu modülü paylaşır.
 * Kural tek yerde durur ki üyeye "puanlayabilirsin" denen seans ile raporda
 * "puanlanabilirdi" sayılan seans hep aynı küme olsun.
 */

/** Seans bitiminden sonra üyenin puan verebileceği süre */
export const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Puan bir kez verilir; düzenleme yoktur. Üyeye gönderimden önce onay sorulur.

/** Bu puan ve altı yöneticiye anlık bildirim çıkarır */
export const LOW_RATING_THRESHOLD = 2;

/**
 * Raporda "düşük puan payı" metriğinin sınırı. Alarm sınırından yüksektir:
 * 1-5 ölçeğinde ortalamalar tavana yapışır, asıl sinyal 3 ve altının oranındadır.
 */
export const LOW_SHARE_THRESHOLD = 3;

/** Ortalamanın gösterilmesi için gereken en az puan sayısı */
export const MIN_RATINGS_FOR_AVERAGE = 5;

/** Bayes düzeltmesinde kullanılan sanal örneklem ağırlığı */
export const BAYES_PRIOR_WEIGHT = 10;

/**
 * Puanlanabilir seans WHERE koşulu (tablo takma adı `s` varsayılır).
 * Pencere/üye filtreleri çağıran tarafta eklenir.
 * @param {number} nowIdx    $n — şu anki zaman (ms)
 * @param {number} goLiveIdx $n — puanlama sisteminin devreye alındığı an (ms)
 */
export function ratableSessionSql(nowIdx, goLiveIdx) {
  return `s.deleted_at IS NULL
      AND s.member_id IS NOT NULL
      AND s.staff_id IS NOT NULL
      AND s.end_ts < $${nowIdx}
      AND s.end_ts >= $${goLiveIdx}
      AND (s.checked_in_at IS NOT NULL OR s.attendance_outcome = 'present')`;
}

/** JS tarafı karşılığı — DTO üretiminde kullanılır. */
export function isSessionRatable(row, goLiveTs, now = Date.now()) {
  if (row.deleted_at != null) return false;
  if (row.member_id == null || row.staff_id == null) return false;
  const endTs = Number(row.end_ts ?? row.endTs);
  if (!Number.isFinite(endTs)) return false;
  if (endTs >= now) return false;
  if (endTs < goLiveTs) return false;
  if (now - endTs > RATING_WINDOW_MS) return false;
  const checkedIn = row.checked_in_at ?? row.checkedInAt ?? null;
  const outcome = row.attendance_outcome ?? row.attendanceOutcome ?? null;
  return checkedIn != null || outcome === 'present';
}

/**
 * Bayes düzeltilmiş ortalama: (C·m + Σx) / (C + n)
 * Az örneklemli personelin tepeye çıkmasını engeller.
 */
export function bayesianAverage(sum, count, globalMean, weight = BAYES_PRIOR_WEIGHT) {
  const n = Number(count) || 0;
  if (n === 0) return null;
  const m = Number(globalMean);
  if (!Number.isFinite(m)) return Number(sum) / n;
  return (weight * m + Number(sum)) / (weight + n);
}
