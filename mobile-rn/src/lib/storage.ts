import * as SecureStore from 'expo-secure-store';

import { TOKEN_KEY } from '../config';

/**
 * JWT saklama — web'de localStorage idi; RN'de şifreli SecureStore (keychain/keystore).
 * Web'in senkron getToken'ının aksine hepsi async; bu yüzden axios request
 * interceptor'ı async token okur. Bellek kopyası ile her istekte disk okunmaz.
 */
let cachedToken: string | null | undefined;

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
