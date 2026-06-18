import { Stack, usePathname, useRouter } from 'expo-router';

import { RoleShell, type NavSection } from '../../src/components/drawer/role-shell';
import { useAuth } from '../../src/features/auth';
import { useUnreadCount } from '../../src/features/notifications/api/hooks';
import { NotificationToaster } from '../../src/features/notifications/components/notification-toaster';
import { useStaffShiftReminderPoll } from '../../src/features/staff/api/hooks';

/** Personel kabuğu — web staff-mobile-bar: tek "Menü" butonu + drawer. */
export default function StaffLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { count: unread } = useUnreadCount();
  useStaffShiftReminderPoll();

  const go = (path: string) => router.navigate(path as never);
  const isActive = (seg: string, exact = false) =>
    exact ? pathname === seg : pathname.startsWith(seg);

  const sections: NavSection[] = [
    {
      title: 'Menü',
      items: [
        { key: 'cal', label: 'Takvim', icon: 'calendar', active: isActive('/(staff)', true), onPress: () => go('/(staff)') },
        { key: 'notif', label: 'Bildirimler', icon: 'notifications', active: isActive('/(staff)/notifications'), badge: unread > 0, onPress: () => go('/(staff)/notifications') },
        { key: 'profile', label: 'Profil', icon: 'person', active: isActive('/(staff)/profile'), onPress: () => go('/(staff)/profile') },
      ],
    },
  ];
  const footer: NavSection = {
    title: 'Hesap',
    items: [{ key: 'logout', label: 'Çıkış', icon: 'log-out', danger: true, onPress: signOut }],
  };
  return (
    <RoleShell brandText="Seans Planlayıcı" sections={sections} footer={footer}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
      <NotificationToaster />
    </RoleShell>
  );
}
