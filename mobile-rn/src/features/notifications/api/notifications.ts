import { apiClient } from '../../../lib/api-client';

export interface StaffNotification {
  id: number;
  type: string;   // 'cancel' | 'checkin'
  title: string;
  body: string;
  at: number;     // ms timestamp
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsResult {
  items: StaffNotification[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export type PeriodFilter = 'day' | 'week' | 'month' | 'year';

/** Seçili periyodun since/until ms değerlerini hesapla (UTC+3 / İstanbul). */
export function periodToRange(period: PeriodFilter): { since: number; until: number } {
  const now = Date.now();
  const TZ_OFFSET = 3 * 3600 * 1000;
  // Bugünün başlangıcı — Istanbul 00:00
  const todayUtcMidnight = Math.floor((now + TZ_OFFSET) / 86400000) * 86400000 - TZ_OFFSET;

  switch (period) {
    case 'day':   return { since: todayUtcMidnight, until: now };
    case 'week':  return { since: todayUtcMidnight - 6 * 86400000, until: now };
    case 'month': return { since: todayUtcMidnight - 29 * 86400000, until: now };
    case 'year':  return { since: todayUtcMidnight - 364 * 86400000, until: now };
  }
}

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function fmtSessionDateTime(ts: number): string {
  const d = new Date(ts + 3 * 3600 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${DAYS_TR[d.getUTCDay()]} ${hh}:${min}`;
}

function fromApi(row: any): StaffNotification {
  const at = Number(row.at ?? 0);
  const memberName: string = row.memberName || row.member_name || 'Üye';
  const staffName: string = row.staffName || row.staff_name || '';
  const source: string = row.source || '';
  const type: string = row.type || 'checkin';

  let title = '';
  let body = '';

  if (type === 'shift_reminder') {
    title = row.title || 'Onay bekleyen seanslar';
    body  = row.body  || 'Bu gün için onaylanmamış seans var.';
  } else if (type === 'member_cancel') {
    // Üye kendi iptali — title/body backend'den hazır gelir
    title = row.title || 'Üye Randevu İptali';
    body  = row.body  || (memberName ? `${memberName} randevusunu iptal etmiştir.` : '');
  } else if (type === 'cancel') {
    // Admin / personel iptali
    const startTs = row.startTs ?? row.start_ts;
    const datePart = startTs ? fmtSessionDateTime(Number(startTs)) : '';
    title = 'Admin İptali';
    const parts = [memberName, datePart, staffName, 'Seans İptali'].filter(Boolean);
    body = parts.join(' / ');
  } else {
    const methodLabel = source === 'card' ? 'Kart' : source === 'phone' ? 'Telefon' : 'QR';
    const timeLabel = at ? (() => {
      const d = new Date(at + 3 * 3600 * 1000);
      return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    })() : '';
    title = `Giriş: ${memberName}`;
    const timePart = timeLabel ? ` saat ${timeLabel}'de` : '';
    body = staffName
      ? `${memberName},${timePart} ${methodLabel} ile giriş yaptı (${staffName})`
      : `${memberName},${timePart} ${methodLabel} ile giriş yaptı`;
  }

  return {
    id: Number(row.id),
    type,
    title,
    body,
    at,
    createdAt: at ? new Date(at).toISOString() : '',
    readAt: null,
  };
}

export async function listNotifications(opts: {
  since?: number;
  until?: number;
  period?: PeriodFilter;
  page?: number;
  perPage?: number;
} = {}): Promise<NotificationsResult> {
  const { page = 1, perPage = 20 } = opts;
  let since: number;
  let until: number;
  if (opts.since != null && opts.until != null) {
    since = opts.since;
    until = opts.until;
  } else {
    const range = periodToRange(opts.period ?? 'week');
    since = range.since;
    until = range.until;
  }
  const { data } = await apiClient.get('/sessions/notifications', {
    params: { since, until, page, per_page: perPage },
  });
  // Geriye dönük uyumluluk: backend eski format dönerse dizi olabilir
  if (Array.isArray(data)) {
    const items = data.map(fromApi);
    return { items, total: items.length, page: 1, perPage: items.length || perPage, totalPages: 1 };
  }
  return {
    items: (data?.items ?? []).map(fromApi),
    total: data?.total ?? 0,
    page: data?.page ?? page,
    perPage: data?.perPage ?? perPage,
    totalPages: data?.totalPages ?? 0,
  };
}

export async function markNotificationRead(_id: number): Promise<void> {
  // sessions/notifications'da okundu takibi yok
}

export async function registerPushToken(token: string): Promise<void> {
  await apiClient.post('/auth/push-token', { token });
}
