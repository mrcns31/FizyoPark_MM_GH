import { apiClient } from '../../../lib/api-client';
import { getToken, removeToken, setToken } from '../../../lib/storage';
import type { UserProfile } from '../../../types/api';

/** Web api.js'teki auth çağrılarının birebir karşılığı (axios üzerinden). */

export interface LoginResponse {
  token: string;
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

export async function logout(): Promise<void> {
  try {
    if (await getToken()) {
      await apiClient.post('/auth/logout', {});
    }
  } catch {
    // logout backend hatası önemsiz — token'ı yine de sileriz
  } finally {
    await removeToken();
  }
}
