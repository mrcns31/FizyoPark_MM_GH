import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Bildirime tıklanınca açılacak ekran. Backend yalnızca `data.type` gönderir;
 * route eşlemesi burada durur, böylece ekran yolu değişince backend'e dokunmak gerekmez.
 */
type PushTarget = { route: string; roles: readonly string[] };

const ADMIN_REQUESTS: PushTarget = {
  route: '/(admin)/more/requests',
  roles: ['admin', 'manager'],
};

const PUSH_TARGETS: Record<string, PushTarget> = {
  password_reset_request: ADMIN_REQUESTS,
  package_request: ADMIN_REQUESTS,
  deletion_request: ADMIN_REQUESTS,
};

/**
 * Bildirimin data alanından hedef ekranı çözer.
 * Rol uymuyorsa veya tip tanınmıyorsa null döner — yanlış role ait ekran açılmaz.
 */
export function resolveNotificationRoute(data: unknown, role: string | null): string | null {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string') return null;

  const target = PUSH_TARGETS[type];
  if (!target) return null;
  if (!role || !target.roles.includes(role)) return null;

  return target.route;
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId =
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
