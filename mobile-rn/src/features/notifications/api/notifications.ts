import { apiClient } from '../../../lib/api-client';

/** Personel/yönetici bildirimleri — /session-attendance/notifications/*. */

export interface StaffNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function fromApi(row: any): StaffNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title || '',
    body: row.body || '',
    readAt: row.readAt ?? row.read_at ?? null,
    createdAt: row.createdAt ?? row.created_at,
  };
}

export async function listNotifications(unreadOnly = false): Promise<StaffNotification[]> {
  const { data } = await apiClient.get('/session-attendance/notifications/list', {
    params: unreadOnly ? { unread: '1' } : {},
  });
  return (data?.notifications ?? []).map(fromApi);
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.post(`/session-attendance/notifications/${id}/read`, {});
}
