import { Alert } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';

import { RoleShell, type NavSection } from '../../src/components/drawer/role-shell';
import { useAuth } from '../../src/features/auth';
import { useDeletionRequests, useOpenDoor, usePackageRequests } from '../../src/features/admin/api/hooks';
import { useUnreadCount } from '../../src/features/notifications/api/hooks';
import { NotificationToaster } from '../../src/features/notifications/components/notification-toaster';

/**
 * Admin kabuğu — drawer (yan menü). Header'da hamburger ile açılır.
 * Ekle eylemleri sayfalarda FAB ile. Kapıyı Aç drawer içinde.
 */
export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const door = useOpenDoor();
  const { count: unread } = useUnreadCount();
  const pkgReqs = usePackageRequests();
  const delReqs = useDeletionRequests();
  const reqCount = (pkgReqs.data?.length ?? 0) + (delReqs.data?.length ?? 0);

  const go = (path: string) => router.navigate(path as never);
  const active = (seg: string) => pathname.startsWith(seg);

  function onOpenDoor() {
    Alert.alert('Kapıyı aç', 'Tesis kapısı açılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Aç',
        onPress: () =>
          door.mutate(undefined, {
            onSuccess: () => Alert.alert('Kapı', 'Kapı açma komutu gönderildi.'),
            onError: (e) => Alert.alert('Hata', (e as Error).message),
          }),
      },
    ]);
  }

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
        { key: 'req', label: 'Talepler', icon: 'file-tray-full', active: active('/more/requests'), badge: reqCount > 0, onPress: () => go('/(admin)/more/requests') },
      ],
    },
  ];

  const footer: NavSection = {
    title: 'Yönetim',
    items: [
      { key: 'settings', label: 'Ayarlar', icon: 'settings-outline', active: inSettings, onPress: () => router.push('/(admin)/more/settings') },
      { key: 'door', label: 'Kapıyı Aç', icon: 'log-in', onPress: onOpenDoor },
      { key: 'logout', label: 'Çıkış', icon: 'log-out', danger: true, onPress: signOut },
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
