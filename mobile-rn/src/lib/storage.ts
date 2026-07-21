import * as SecureStore from 'expo-secure-store';

import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '../config';

/**
 * JWT saklama — web'de localStorage idi; RN'de şifreli SecureStore (keychain/keystore).
 * Web'in senkron getToken'ının aksine hepsi async; bu yüzden axios request
 * interceptor'ı async token okur. Bellek kopyası ile her istekte disk okunmaz.
 *
 * İki token: kısa ömürlü access token (getToken) ve "Beni hatırla" oturumlarında
 * sessiz yenileme için uzun ömürlü refresh token (getRefreshToken).
 */
let cachedToken: string | null | undefined;
let cachedRefreshToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? null;
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken !== undefined) return cachedRefreshToken;
  cachedRefreshToken = (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) ?? null;
  return cachedRefreshToken;
}

export async function setRefreshToken(token: string): Promise<void> {
  cachedRefreshToken = token;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function removeRefreshToken(): Promise<void> {
  cachedRefreshToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/** Hem access hem refresh token'ı temizle (çıkış / oturum düşmesi). */
export async function clearAuthTokens(): Promise<void> {
  await Promise.all([removeToken(), removeRefreshToken()]);
}
