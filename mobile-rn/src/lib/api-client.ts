import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { API_BASE, REQUEST_TIMEOUT_MS } from '../config';
import { getToken, removeToken } from './storage';

/**
 * Axios istemcisi — web'deki apiFetch davranışının birebir karşılığı:
 *  - Her isteğe Bearer token ekler (request interceptor)
 *  - 401'de token'ı siler (response interceptor)
 *  - Hata mesajını backend'in {error|message|errors[]} biçiminden normalize eder
 *  - Ağ hatasını Türkçe mesaja çevirir
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
    if (status === 401) {
      await removeToken();
      onUnauthorized?.();
    }
    throw new ApiError(extractMessage(data, error.message || 'Bilinmeyen hata'), status, data);
  }
);
