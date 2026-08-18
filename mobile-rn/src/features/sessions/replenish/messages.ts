import type { DeleteSessionResult } from '../api/sessions';

/**
 * Telafi seansı sonucu metinleri — web app.js'teki karşılıklarıyla birebir aynı tutulur
 * (REPLENISH_FAIL_LABELS / replenishFailSummary).
 */

export const REPLENISH_FAIL_LABELS: Record<string, string> = {
  no_available_slot: 'denenen tarihlerin hiçbirine yerleştirilemedi',
  no_matching_day: 'paketin gün/saat deseni kalan tarihlere denk gelmiyor',
  package_ended: 'paket bitiş tarihi dolmuş',
  package_full: 'pakette boş ders hakkı kalmamış',
  no_slots: 'pakette gün/saat tanımı yok',
  invalid_end_date: 'paketin bitiş tarihi geçersiz',
  invalid_start: 'telafi başlangıç tarihi hesaplanamadı',
  package_not_found: 'paket bulunamadı',
  error: 'beklenmeyen bir hata oluştu',
};

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** "2026-09-29" → "29.09.2026" */
export function formatIsoDateTr(iso?: string | null): string {
  if (!iso) return '';
  return String(iso).slice(0, 10).split('-').reverse().join('.');
}

/** Silinen seansın "Seda Erenoğlu — 12.08.2026 Salı 11:00" etiketi. */
export function deletedSessionLabel(result: DeleteSessionResult): string {
  const ts = result?.deletedSession?.startTs;
  if (!ts) return '';
  const d = new Date(Number(ts));
  const when = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${DAYS[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  // Grup seansında birden çok üye olur; hangisinin seansı olduğu yazmazsa mesaj belirsiz kalır.
  const who = result?.deletedSession?.memberName?.trim();
  return who ? `${who} — ${when}` : when;
}

/** Telafi için taranacak gün hiç kalmadığı durum — elle yerleştirme de yapılamaz. */
export function isPackageEnded(result: DeleteSessionResult): boolean {
  return result?.replenishedReason === 'package_ended';
}

/** Modal ve uyarı diyaloğunun ortak açıklama metni. */
export function replenishFailSummary(result: DeleteSessionResult): string {
  const reasonKey = result.replenishedReason || '';
  const reason = REPLENISH_FAIL_LABELS[reasonKey] || reasonKey;
  const label = deletedSessionLabel(result);
  const head = label ? `${label} seansı silindi` : 'Seans silindi';

  // Hiç gün taranmadığı için "denendi" havası veren metin kullanılmaz; durum tek cümlede söylenir.
  if (reasonKey === 'package_ended') {
    const end = formatIsoDateTr(result.packageEndDate);
    return `${head}.\nPaket bitiş tarihi${end ? ` (${end})` : ''} dolduğu için telafi eklenemedi. Paket bir seans eksik kalacak.`;
  }

  let msg = `${head} ancak telafi seansı eklenemedi: ${reason}.\nPaket bir seans eksik kalacak.`;

  const candidates = (result.replenishCandidates || []).slice(0, 4);
  if (candidates.length) {
    msg += '\n\nDenenen tarihler:\n' + candidates
      .map((c) => `• ${formatIsoDateTr(c.date)} ${c.day_name || ''} ${c.start_time || ''} — ${c.reason_label || 'yerleştirilemedi'}`)
      .join('\n');
  }
  if (result.packageEndDate) {
    msg += `\n\nPaket bitiş tarihi: ${formatIsoDateTr(result.packageEndDate)}`;
  }
  return msg;
}
