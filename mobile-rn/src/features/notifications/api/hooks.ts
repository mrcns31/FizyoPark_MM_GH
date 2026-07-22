import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { listNotifications, markNotificationRead } from './notifications';

export const notificationKeys = {
  list: (since: number, until: number, page: number) => ['notifications', since, until, page] as const,
  recent: ['notifications', 'recent'] as const,
  latest: ['notifications', 'latest'] as const,
};

export function useNotifications(since: number, until: number, page: number, perPage = 20, types?: string, q?: string) {
  return useQuery({
    queryKey: [...notificationKeys.list(since, until, page), types ?? 'all', q ?? ''],
    queryFn: () => listNotifications({ since, until, page, perPage, types, q }),
    staleTime: 15_000,
  });
}

const LAST_SEEN_KEY = 'notif_last_seen_at';

async function getLastSeenAt(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(LAST_SEEN_KEY);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

async function setLastSeenAt(ts: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, String(ts));
  } catch {}
}

/** Sidebar badge: AsyncStorage'daki lastSeenAt'ten sonraki (son 30 gün içindeki) bildirim sayısı. */
export function useUnreadCount() {
  const [lastSeenAt, setLastSeenAtState] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getLastSeenAt().then((v) => {
      if (alive) setLastSeenAtState(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();
  const since = now - 30 * 24 * 3600 * 1000;
  const q = useQuery({
    queryKey: notificationKeys.recent,
    queryFn: () => listNotifications({ since, until: now, page: 1, perPage: 50 }),
    refetchInterval: 20_000,
  });
  const items = q.data?.items ?? [];
  const count = lastSeenAt == null ? 0 : items.filter((n) => n.at > lastSeenAt).length;
  return { ...q, count };
}

/** Bildirimler ekranı açıldığında en son bildirimi "görüldü" olarak işaretler — sidebar badge'i temizler. */
export function useMarkNotificationsSeen() {
  const qc = useQueryClient();
  return useCallback(
    (ts: number) => {
      if (!ts) return;
      getLastSeenAt().then((current) => {
        if (ts > current) {
          setLastSeenAt(ts).then(() => qc.invalidateQueries({ queryKey: notificationKeys.recent }));
        }
      });
    },
    [qc],
  );
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
