import Constants from 'expo-constants';

/**
 * Uygulama yapılandırması — env > app.json extra > varsayılan.
 *
 * API_BASE: web'deki window.__API_BASE__ karşılığı. Fiziksel cihazda "localhost"
 * çalışmaz; geliştirici makinesinin LAN IP'sini EXPO_PUBLIC_API_BASE ile verin
 * (ör. http://192.168.1.20:3000/api).
 */
const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
const fromExtra = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase;

/**
 * Expo dev sunucusunun host'undan API adresini otomatik türet.
 * Fiziksel cihazda Metro'ya zaten Mac'in LAN IP'siyle bağlanılıyor; aynı IP'yi
 * backend (:3000) için kullanınca "localhost" sorunu olmadan çalışır. Simülatörde
 * host 127.0.0.1 gelir ve sorunsuz çalışır. EXPO_PUBLIC_API_BASE verilirse o öncelikli.
 */
function inferApiBaseFromExpoHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ||
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (!hostUri) return null;
  const host = String(hostUri).split('/')[0].split(':')[0].trim();
  if (!host) return null;
  return `http://${host}:3000/api`;
}

export const API_BASE = (
  fromEnv ||
  fromExtra ||
  inferApiBaseFromExpoHost() ||
  'http://localhost:3000/api'
).replace(/\/$/, '');

// Production build'de HTTP kullanılıyorsa uyar
if (__DEV__ === false && API_BASE.startsWith('http://')) {
  console.warn('[GÜVENLİK] API_BASE HTTP ile başlıyor. Production için EXPO_PUBLIC_API_BASE=https://... ayarlayın.');
}

/** SecureStore'da JWT anahtarı (web'de localStorage 'seans_planner_token' idi). */
export const TOKEN_KEY = 'seans_planner_token';

export const REQUEST_TIMEOUT_MS = 15000;
