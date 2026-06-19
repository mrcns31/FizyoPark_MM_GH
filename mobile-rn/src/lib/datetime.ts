/** Europe/Istanbul sabit saat dilimiyle tarih/saat formatlama (backend ts'leri TR yerel). */

const TZ = 'Europe/Istanbul';

const timeFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dayFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatTime(ts: number): string {
  return timeFmt.format(new Date(ts));
}

export function formatSessionRange(startTs: number, endTs: number): string {
  return `${formatTime(startTs)} - ${formatTime(endTs)}`;
}

export function formatDayLabel(ts: number): string {
  return dayFmt.format(new Date(ts));
}

const isoDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Istanbul'a göre bir ts'in YYYY-MM-DD karşılığı (varsayılan: bugün). */
export function toDateStr(ts: number = Date.now()): string {
  return isoDateFmt.format(new Date(ts));
}

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });
const wdFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const WD_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Istanbul'a göre saat (0-23). */
export function hourOfTs(ts: number): number {
  return Number(hourFmt.format(new Date(ts)));
}

/** Istanbul'a göre haftanın günü (0=Pazar ... 6=Cumartesi). */
export function dayOfWeekOfTs(ts: number): number {
  return WD_MAP[wdFmt.format(new Date(ts))] ?? 0;
}

const WEEKDAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/** 0=Pazar ... 6=Cumartesi */
export function weekdayShort(dow: number): string {
  return WEEKDAYS_SHORT[((dow % 7) + 7) % 7];
}

const DAY_MS = 24 * 3600 * 1000;

/** Yerel günün başlangıcı (00:00). İstanbul cihaz için yeterli. */
function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** ts'i içeren haftanın Pazartesi 00:00'ı. */
export function startOfWeekTs(ts: number): number {
  const d = new Date(startOfLocalDay(ts));
  const dow = d.getDay(); // 0=Paz
  const diff = (dow + 6) % 7; // Pazartesi'ye kaç gün geri
  return d.getTime() - diff * DAY_MS;
}

/** ts'i içeren ayın 1'i 00:00. */
export function startOfMonthTs(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
}

/** ts'i içeren ayın son günü 00:00. */
export function endOfMonthTs(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 0, 0, 0, 0).getTime();
}

/** [startTs, endTs] aralığındaki her gün için öğlen ts'i (DST güvenli). */
export function enumerateDays(startTs: number, endTs: number): number[] {
  const out: number[] = [];
  let cur = startOfLocalDay(startTs);
  const end = startOfLocalDay(endTs);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(cur + 12 * 3600 * 1000); // öğlen
    cur += DAY_MS;
    guard++;
  }
  return out;
}

const dayHeaderFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Pazartesi, 16 Haziran" */
export function dayHeaderLabel(ts: number): string {
  // tr-TR çıktısı "Pazartesi 16 Haziran" → ilk boşluğa virgül
  return dayHeaderFmt.format(new Date(ts)).replace(' ', ', ');
}

const monthLabelFmt = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, month: 'long', year: 'numeric' });
export function monthLabel(ts: number): string {
  return monthLabelFmt.format(new Date(ts));
}
