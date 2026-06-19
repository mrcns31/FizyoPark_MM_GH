import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listNotifications, markNotificationRead } from './notifications';

export const notificationKeys = {
  list: ['notifications', 'list'] as const,
};

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: [...notificationKeys.list, unreadOnly],
    queryFn: () => listNotifications(unreadOnly),
    refetchInterval: 20_000, // web NOTIFICATION_INTERVAL_MS paritesi
  });
}

export function useUnreadCount() {
  const q = useNotifications(false);
  const count = (q.data ?? []).filter((n) => !n.readAt).length;
  return { ...q, count };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.list }),
  });
}
