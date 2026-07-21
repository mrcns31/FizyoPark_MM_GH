import { apiClient } from '../../../lib/api-client';
import {
  clearAuthTokens,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
} from '../../../lib/storage';
import type { UserProfile } from '../../../types/api';

/** Web api.js'teki auth çağrılarının birebir karşılığı (axios üzerinden). */

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user?: UserProfile;
  [k: string]: unknown;
}

export async function login(
  email: string,
  password: string,
  rememberMe?: boolean
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', {
    email,
    password,
    rememberMe: !!rememberMe,
  });
  if (data.token) await setToken(data.token);
  // "Beni hatırla" seçildiyse backend refresh token döner — sessiz yenileme için sakla
  if (data.refreshToken) await setRefreshToken(data.refreshToken);
  return data;
}

export async function getMe(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/auth/me');
  return data;
}

export async function acceptConsent(): Promise<void> {
  await apiClient.post('/auth/consent', {});
}

export async function getLegalLinks(): Promise<Record<string, string>> {
  const { data } = await apiClient.get('/auth/legal-links');
  return data;
}

export async function setPassword(newPassword: string, confirmPassword: string): Promise<void> {
  await apiClient.post('/auth/set-password', { newPassword, confirmPassword });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  await apiClient.post('/auth/change-password', {
    currentPassword,
    newPassword,
    confirmPassword,
  });
}

export async function updateAccountProfile(body: Record<string, unknown>): Promise<void> {
  await apiClient.put('/auth/account', body || {});
}

export async function verifyAdminPassword(password: string): Promise<void> {
  await apiClient.post('/auth/verify-password', { password });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}

export async function logout(): Promise<void> {
  try {
    if (await getToken()) {
      const refreshToken = await getRefreshToken();
      // refreshToken gönderilirse backend bu cihazın oturumunu kesin iptal eder
      await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {});
    }
  } catch {
    // logout backend hatası önemsiz — token'ları yine de sileriz
  } finally {
    await clearAuthTokens();
  }
}
