import { Stack, usePathname, useRouter } from 'expo-router';

import { RoleShell, type NavSection } from '../../src/components/drawer/role-shell';
import {
  useDeletionRequests,
  usePackageRequests,
  usePasswordResetRequests,
} from '../../src/features/admin/api/hooks';
import { useUnreadCount } from '../../src/features/notifications/api/hooks';
import { NotificationToaster } from '../../src/features/notifications/components/notification-toaster';

/**
 * Admin kabuğu — drawer (yan menü). Header'da hamburger ile açılır.
 * Ekle eylemleri sayfalarda FAB ile. Çıkış drawer'da değil, Ayarlar hub'ında.
 */
export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { count: unread } = useUnreadCount();
  const pkgReqs = usePackageRequests();
  const delReqs = useDeletionRequests();
  const pwReqs = usePasswordResetRequests();
  const reqCount =
    (pkgReqs.data?.length ?? 0) + (delReqs.data?.length ?? 0) + (pwReqs.data?.length ?? 0);

  const go = (path: string) => router.navigate(path as never);
  const active = (seg: string) => pathname.startsWith(seg);

  // Ayarlar hub'a giren yönetim alt-route'ları (Ayarlar öğesi bunlarda da aktif görünür)
  const inSettings =
    active('/more/settings') ||
    active('/packages') ||
    active('/more/extend-package') ||
    active('/more/staff') ||
    active('/more/rooms') ||
    active('/more/working-hours') ||
    active('/more/closure-days') ||
    active('/more/activity-logs') ||
    active('/more/account');

  const sections: NavSection[] = [
    {
      title: 'Menü',
      items: [
        { key: 'cal', label: 'Takvim', icon: 'calendar', active: active('/planner'), onPress: () => go('/(admin)/planner') },
        { key: 'mem', label: 'Üyeler', icon: 'people', active: pathname === '/members', onPress: () => go('/(admin)/members') },
        { key: 'expired', label: 'Paketi Bitmiş Üyeler', icon: 'time-outline', active: active('/members/expired'), onPress: () => router.push('/(admin)/members/expired') },
        { key: 'former', label: 'Eski Üyeler', icon: 'person-remove', active: active('/members/former'), onPress: () => router.push('/(admin)/members/former') },
        { key: 'entry', label: 'Giriş Listesi', icon: 'enter-outline', active: active('/more/entry-list'), onPress: () => router.push('/(admin)/more/entry-list') },
        { key: 'reports', label: 'Raporlar', icon: 'bar-chart-outline', active: active('/more/reports'), onPress: () => router.push('/(admin)/more/reports') },
        { key: 'notif', label: 'Bildirimler', icon: 'notifications', active: active('/notifications'), badge: unread > 0, onPress: () => go('/(admin)/notifications') },
        { key: 'broadcast', label: 'Bildirim Gönder', icon: 'megaphone-outline', active: active('/more/broadcast-members'), onPress: () => router.push('/(admin)/more/broadcast-members') },
        { key: 'req', label: 'Talepler', icon: 'file-tray-full', active: active('/more/requests'), badge: reqCount > 0, onPress: () => go('/(admin)/more/requests') },
      ],
    },
  ];

  const footer: NavSection = {
    title: 'Yönetim',
    items: [
      { key: 'settings', label: 'Ayarlar', icon: 'settings-outline', active: inSettings, onPress: () => router.push('/(admin)/more/settings') },
    ],
  };

  return (
    <RoleShell brandText="Seans Planlayıcı" sections={sections} footer={footer}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      />
      <NotificationToaster />
    </RoleShell>
  );
}
