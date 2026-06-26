import { apiClient } from '../../../lib/api-client';

export interface BroadcastResult {
  broadcastId: number;
  totalSelected: number;
  sent: number;
  noToken: number;
  message: string;
}

export interface Broadcast {
  id: number;
  sentByName: string;
  title: string;
  body: string;
  totalSelected: number;
  totalSent: number;
  totalNoToken: number;
  createdAt: string;
}

export interface BroadcastRecipient {
  memberId: number;
  memberName: string;
  hasToken: boolean;
}

export async function sendBroadcast(opts: {
  memberIds: number[];
  title: string;
  body: string;
}): Promise<BroadcastResult> {
  const { data } = await apiClient.post('/admin/broadcast', opts);
  return data;
}

export async function listBroadcasts(page = 1, limit = 20): Promise<{
  items: Broadcast[];
  total: number;
  totalPages: number;
}> {
  const { data } = await apiClient.get('/admin/broadcast', { params: { page, limit } });
  return {
    items: (data.items ?? []).map((r: any) => ({
      id: r.id,
      sentByName: r.sent_by_name,
      title: r.title,
      body: r.body,
      totalSelected: r.total_selected,
      totalSent: r.total_sent,
      totalNoToken: r.total_no_token,
      createdAt: r.created_at,
    })),
    total: data.total ?? 0,
    totalPages: data.totalPages ?? 1,
  };
}

export async function listBroadcastRecipients(broadcastId: number): Promise<BroadcastRecipient[]> {
  const { data } = await apiClient.get(`/admin/broadcast/${broadcastId}/recipients`);
  return (data.recipients ?? []).map((r: any) => ({
    memberId: r.member_id,
    memberName: r.member_name,
    hasToken: r.has_token,
  }));
}
