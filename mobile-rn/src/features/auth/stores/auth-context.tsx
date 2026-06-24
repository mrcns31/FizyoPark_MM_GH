import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { setUnauthorizedHandler } from '../../../lib/api-client';
import { getToken } from '../../../lib/storage';
import { getExpoPushToken } from '../../../lib/push-notifications';
import { registerPushToken } from '../../notifications/api/notifications';
import type { Role, UserProfile } from '../../../types/api';
import { authKeys, useCurrentUser, useLogin, useLogout } from '../api/hooks';

interface AuthContextValue {
  user: UserProfile | null;
  role: Role | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Oturum durumunu yöneten provider:
 *  - Açılışta SecureStore token'ını okur
 *  - Token varsa /auth/me ile kullanıcıyı çeker (react-query)
 *  - 401 interceptor'ı buraya bağlanır → token düşünce state temizlenir
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  const userQuery = useCurrentUser(hasToken === true);
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  // Açılışta token kontrolü
  useEffect(() => {
    let active = true;
    getToken().then((t) => {
      if (active) setHasToken(Boolean(t));
    });
    return () => {
      active = false;
    };
  }, []);

  // 401 → oturumu düşür
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setHasToken(false);
      queryClient.removeQueries({ queryKey: authKeys.me });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  // Uygulama açılışında kullanıcı zaten giriş yapmışsa push token kaydet
  const userId = userQuery.data?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    getExpoPushToken().then((token) => {
      if (token) registerPushToken(token).catch(() => {});
    });
  }, [userId]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe?: boolean) => {
      await loginMutation.mutateAsync({ email, password, rememberMe });
      setHasToken(true);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      getExpoPushToken().then((token) => {
        if (token) registerPushToken(token).catch(() => {});
      });
    },
    [loginMutation, queryClient]
  );

  const signOut = useCallback(async () => {
    await logoutMutation.mutateAsync();
    setHasToken(false);
    queryClient.clear();
  }, [logoutMutation, queryClient]);

  const user = userQuery.data ?? null;
  const isInitializing =
    hasToken === null || (hasToken === true && userQuery.isLoading);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isInitializing,
      isAuthenticated: Boolean(user),
      signIn,
      signOut,
    }),
    [user, isInitializing, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
