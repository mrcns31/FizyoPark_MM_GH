import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { API_BASE, REQUEST_TIMEOUT_MS } from '../config';
import { clearAuthTokens, getRefreshToken, getToken, setToken } from './storage';

/**
 * Axios istemcisi — web'deki apiFetch davranışının birebir karşılığı:
 *  - Her isteğe Bearer token ekler (request interceptor)
 *  - 401'de önce refresh token ile sessiz yenileme dener; olmazsa token'ı siler
 *  - Hata mesajını backend'in {error|message|errors[]} biçiminden normalize eder
 *  - Ağ hatasını Türkçe mesaja çevirir
 *
 * "Beni hatırla" oturumlarında access token süresi dolunca (401), saklanan refresh
 * token ile /auth/refresh çağrılıp yeni access token alınır ve asıl istek tekrarlanır.
 * Kullanıcı yalnızca refresh de başarısız olursa (çıkış / süre bitti / hesap kapalı)
 * giriş ekranına düşer.
 *
 * 401 olduğunda oturum durumunu güncellemek için onUnauthorized callback'i
 * AuthProvider tarafından kaydedilir (lib feature'lara bağımlı olmasın diye).
 */
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/**
 * Aynı anda birçok istek 401 alabilir; hepsi tek bir yenileme paylaşsın diye
 * refresh çağrısı tek-uçuş (single-flight) yapılır. Başarılıysa yeni access token,
 * başarısızsa null döner. apiClient yerine düz axios kullanılır ki interceptor
 * özyinelemeye girmesin.
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ token?: string }>(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
        { timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
      )
      .then(async (res) => {
        const newToken = res.data?.token;
        if (!newToken) return null;
        await setToken(newToken);
        return newToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Normalize edilmiş uygulama hatası. */
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function extractMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (data.error) return data.error;
  if (data.message) return data.message;
  if (Array.isArray(data.errors)) {
    return data.errors.map((e: any) => e.msg || e.message).filter(Boolean).join(', ') || fallback;
  }
  return fallback;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Ağ hatası (sunucuya ulaşılamadı)
    if (error.response === undefined) {
      throw new ApiError('Backend\'e bağlanılamıyor. Sunucu çalışıyor mu?', 0, {
        error: 'Backend\'e bağlanılamıyor. Sunucu çalışıyor mu?',
      });
    }
    const { status, data } = error.response;
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // 401 → önce sessiz yenileme dene (refresh endpoint'in kendisi hariç, sonsuz döngü olmasın)
    if (
      status === 401 &&
      original &&
      !original._retry &&
      !String(original.url ?? '').includes('/auth/refresh')
    ) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        original._retry = true;
        original.headers?.set?.('Authorization', `Bearer ${newToken}`);
        return apiClient(original);
      }
    }

    if (status === 401) {
      await clearAuthTokens();
      onUnauthorized?.();
    }
    throw new ApiError(extractMessage(data, error.message || 'Bilinmeyen hata'), status, data);
  }
);
