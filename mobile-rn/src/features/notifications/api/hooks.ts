import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import { listNotifications, markNotificationRead } from './notifications';

export const notificationKeys = {
  list: (since: number, until: number, page: number) => ['notifications', since, until, page] as const,
  recent: ['notifications', 'recent'] as const,
  latest: ['notifications', 'latest'] as const,
};

export function useNotifications(since: number, until: number, page: number, perPage = 20) {
  return useQuery({
    queryKey: notificationKeys.list(since, until, page),
    queryFn: () => listNotifications({ since, until, page, perPage }),
    staleTime: 15_000,
  });
}

/** Sidebar badge: bugünkü bildirim sayısı. */
export function useUnreadCount() {
  const now = Date.now();
  const TZ = 3 * 3600 * 1000;
  const todayStart = Math.floor((now + TZ) / 86400000) * 86400000 - TZ;
  const q = useQuery({
    queryKey: notificationKeys.recent,
    queryFn: () => listNotifications({ since: todayStart, until: now, page: 1, perPage: 50 }),
    refetchInterval: 20_000,
  });
  const count = q.data?.total ?? 0;
  return { ...q, count };
}

/** En son bildirimin tarihini bulmak için tek kayıt çeker (ORDER BY at DESC). */
export function useLatestNotification() {
  const now = Date.now();
  const since = now - 5 * 365 * 86400000; // 5 yıl geri
  return useQuery({
    queryKey: notificationKeys.latest,
    queryFn: () => listNotifications({ since, until: now, page: 1, perPage: 1 }),
    staleTime: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
