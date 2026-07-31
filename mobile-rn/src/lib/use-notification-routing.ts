import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useAuth } from '../features/auth';
import { resolveNotificationRoute } from './push-notifications';

/**
 * Bildirime tıklanınca ilgili ekrana yönlendirir.
 *
 * İki giriş noktası var:
 *  - uygulama açık/arka plandayken → addNotificationResponseReceivedListener
 *  - uygulama tamamen kapalıyken → getLastNotificationResponseAsync (soğuk açılış)
 *
 * Yönlendirme oturum hazır olana kadar bekletilir: aksi halde useAuthRedirect'in
 * login/landing replace'i araya girip hedefi ezer.
 */
export function useNotificationRouting() {
  const router = useRouter();
  const { isInitializing, isAuthenticated, role } = useAuth();
  const [pendingData, setPendingData] = useState<unknown>(null);

  // Uygulama açıkken veya arka plandayken tıklama
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      setPendingData(response.notification.request.content.data ?? null);
    });
    return () => sub.remove();
  }, []);

  // Soğuk açılış: uygulama kapalıyken tıklanan bildirim
  useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        setPendingData(response.notification.request.content.data ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Oturum hazır olduğunda yönlendir
  useEffect(() => {
    if (pendingData == null) return;
    if (isInitializing || !isAuthenticated) return;

    const route = resolveNotificationRoute(pendingData, role);
    setPendingData(null);
    if (!route) return;

    // useAuthRedirect'in aynı turda yaptığı replace'ten sonra çalışsın
    const timer = setTimeout(() => {
      router.push(route as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingData, isInitializing, isAuthenticated, role, router]);
}
