import { useMutation, useQuery } from '@tanstack/react-query';

import { getToken } from '../../../lib/storage';
import type { UserProfile } from '../../../types/api';
import {
  acceptConsent,
  changePassword,
  getMe,
  login,
  logout,
  setPassword,
} from './auth';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

/**
 * Oturum sahibi kullanıcı. Token yoksa istek atılmaz (enabled).
 * Token varlığını bilmek için önce SecureStore'dan okuruz.
 */
export function useCurrentUser(hasToken: boolean) {
  return useQuery<UserProfile>({
    queryKey: authKeys.me,
    queryFn: getMe,
    enabled: hasToken,
    staleTime: 5 * 60_000,
  });
}

export function useHasToken() {
  return useQuery({
    queryKey: ['auth', 'has-token'],
    queryFn: async () => Boolean(await getToken()),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (vars: { email: string; password: string; rememberMe?: boolean }) =>
      login(vars.email, vars.password, vars.rememberMe),
  });
}

export function useLogout() {
  return useMutation({ mutationFn: logout });
}

export function useAcceptConsent() {
  return useMutation({ mutationFn: acceptConsent });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: (vars: { newPassword: string; confirmPassword: string }) =>
      setPassword(vars.newPassword, vars.confirmPassword),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      changePassword(vars.currentPassword, vars.newPassword, vars.confirmPassword),
  });
}
