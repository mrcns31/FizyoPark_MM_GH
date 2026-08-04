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
/** Rol → o rolün göreceği ekran. Rol listede yoksa yönlendirme yapılmaz. */
type PushTarget = Record<string, string>;

/** Talepler ekranı — yalnızca yönetim görür */
const ADMIN_REQUESTS: PushTarget = {
  admin: '/(admin)/more/requests',
  manager: '/(admin)/more/requests',
};

/** Bildirim listesi — personelin kendi sekmesi ayrı route'ta */
const NOTIFICATIONS: PushTarget = {
  admin: '/(admin)/notifications',
  manager: '/(admin)/notifications',
  staff: '/(staff)/notifications',
};

const PUSH_TARGETS: Record<string, PushTarget> = {
  password_reset_request: ADMIN_REQUESTS,
  package_request: ADMIN_REQUESTS,
  deletion_request: ADMIN_REQUESTS,
  cancel: NOTIFICATIONS,
  rating: NOTIFICATIONS,
};

/**
 * Bildirimin data alanından hedef ekranı çözer.
 * Rol uymuyorsa veya tip tanınmıyorsa null döner — yanlış role ait ekran açılmaz.
 */
export function resolveNotificationRoute(data: unknown, role: string | null): string | null {
  if (!data || typeof data !== 'object') return null;
  const type = (data as { type?: unknown }).type;
  if (typeof type !== 'string' || !role) return null;

  return PUSH_TARGETS[type]?.[role] ?? null;
}

/** Backend tüm push'ları bu kanal üzerinden gönderir (pushNotifications.js → channelId) */
const ANDROID_CHANNEL_ID = 'fizyopark';

/**
 * Android 8+ bildirimi mutlaka bir kanala ait olmalı. Cihazda bu kanal yoksa
 * `channelId: 'fizyopark'` ile gelen push SESSİZCE düşer — hata dönmez, kullanıcı
 * hiçbir şey görmez. iOS channelId alanını yok saydığı için orada sorun çıkmaz.
 * Bu yüzden token alınmadan önce kanal oluşturulur (varsa güncellenir, zararsızdır).
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'FizyoPark Bildirimleri',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {
    // kanal oluşturulamazsa token alma akışı yine de devam etsin
  }
}

/**
 * Push token'ı döner; hiçbir koşulda reject etmez.
 * İzin API'leri de (getPermissionsAsync/requestPermissionsAsync) hata fırlatabiliyor —
 * eskiden yalnızca getExpoPushTokenAsync korunuyordu, o yüzden çağıran taraftaki
 * `.then(...)` zincirleri yakalanmamış promise reddi üretiyordu.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await ensureAndroidChannel();

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

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
