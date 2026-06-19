import { apiClient } from '../../../lib/api-client';

/** İşlem (aktivite) logları (admin) — /activity-logs. */

export interface ActivityLog {
  id: number;
  actorName: string;
  actorDisplay: string;
  action: string;
  entityType: string;
  entityId: string;
  entityDisplay: string;
  detailsDisplay: string;
  createdAt: string;
}

export interface ActivityLogPage {
  items: ActivityLog[];
  page: number;
  totalPages: number;
  total: number;
}

function fromApi(row: any): ActivityLog {
  return {
    id: row.id,
    actorName: row.actor_name || '',
    actorDisplay: row.actor_display || row.actor_name || '—',
    action: row.action || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id != null ? String(row.entity_id) : '',
    entityDisplay: row.entity_display || '',
    detailsDisplay: row.details_display || '',
    createdAt: row.created_at || '',
  };
}

export interface ActivityLogFilter {
  action?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
}

export async function getActivityLogs(
  page = 1,
  limit = 30,
  filter: ActivityLogFilter = {},
): Promise<ActivityLogPage> {
  const params: Record<string, unknown> = { page, limit };
  if (filter.action) params.action = filter.action;
  if (filter.from) params.from = filter.from;
  if (filter.to) params.to = filter.to;
  const { data } = await apiClient.get('/activity-logs', { params });
  const p = data?.pagination ?? {};
  return {
    items: (data?.items ?? []).map(fromApi),
    page: p.page ?? page,
    totalPages: p.totalPages ?? 1,
    total: p.total ?? 0,
  };
}

// Web `actionLabel` ile birebir Türkçe etiketler.
export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Giriş',
  'auth.login_failed': 'Giriş başarısız',
  'auth.change_password': 'Şifre değiştirme',
  'member.create': 'Üye ekleme',
  'member.update': 'Üye güncelleme',
  'member.delete': 'Üye silme',
  'member.delete_permanent': 'Üye tam silme',
  'member.request_deletion': 'Üyelik iptal talebi',
  'member.approve_deletion_request': 'Üyelik iptali onayı',
  'member.reject_deletion_request': 'Üyelik iptal talebi reddi',
  'member.reactivate': 'Üye yeniden aktif',
  'session.create': 'Seans ekleme',
  'session.update': 'Seans güncelleme',
  'session.delete': 'Seans silme',
  'session.delete_bulk': 'Grup seans silme',
  'session.cancel_by_member': 'Üye seans iptali',
  'session.check_in_qr': 'QR ile giriş',
  'session.attendance_confirm': 'Seans giriş onayı',
  'room.create': 'Oda ekleme',
  'room.update': 'Oda güncelleme',
  'room.delete': 'Oda silme',
  'staff.create': 'Personel ekleme',
  'staff.update': 'Personel güncelleme',
  'staff.reset_password': 'Personel şifre sıfırlama',
  'staff.delete': 'Personel silme',
  'package.create': 'Paket ekleme',
  'package.update': 'Paket güncelleme',
  'package.delete': 'Paket silme',
  'member_package.create': 'Üye paketi ekleme',
  'member_package.update': 'Üye paketi güncelleme',
  'member_package.end': 'Üye paketi sonlandırma',
  'settings.working_hours_update': 'Çalışma saatleri güncelleme',
  'closure_period.create': 'Kapanış ekleme',
  'closure_period.delete': 'Kapanış silme',
  'dev_reset': 'Test – veritabanı sıfırlama',
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}
