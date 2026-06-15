/** Yerel takvim günü YYYY-MM-DD */
export function localTodayDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** member_packages satırı / DTO bitiş tarihi */
export function memberPackageEndDateStr(mp) {
  if (mp == null) return '';
  const raw = mp.end_date ?? mp.endDate ?? '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(raw).slice(0, 10);
}

/**
 * MP-04: Üyeliği / paketi bitmiş sayılır:
 * status completed | cancelled VEYA endDate <= bugün
 */
export function isMemberPackageExpired(mp, todayStr = localTodayDateStr()) {
  if (!mp) return false;
  const status = String(mp.status || 'active').toLowerCase();
  if (status === 'completed' || status === 'cancelled') return true;
  const end = memberPackageEndDateStr(mp);
  return !!(end && end <= todayStr);
}

/** Aktif paket: status active ve bitiş tarihi henüz geçmemiş */
export function isMemberPackageActive(mp, todayStr = localTodayDateStr()) {
  if (!mp) return false;
  if (isMemberPackageExpired(mp, todayStr)) return false;
  return String(mp.status || 'active').toLowerCase() === 'active';
}
