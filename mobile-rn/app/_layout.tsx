import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/features/auth';
import { queryClient } from '../src/lib/react-query';
import { colors } from '../src/theme/colors';

/**
 * Kök layout (Expo Router). Tüm provider'lar burada; ekranlar features/'ta,
 * app/ sadece ince route dosyaları tutar (bulletproof korunur).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  useAuthRedirect();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.backgroundTop } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(member)" />
      <Stack.Screen name="(staff)" />
      <Stack.Screen name="(admin)" />
    </Stack>
  );
}

/** Oturum durumuna göre doğru route grubuna yönlendirir. */
function useAuthRedirect() {
  const { isInitializing, isAuthenticated, role, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;
    const group = segments[0]; // '(auth)' | '(member)' | '(staff)' | '(admin)' | undefined

    if (!isAuthenticated) {
      if (group !== '(auth)') router.replace('/(auth)/login');
      return;
    }
    if (user?.mustChangePassword) {
      router.replace('/(auth)/set-password');
      return;
    }
    if (user?.consentRequired) {
      router.replace('/(auth)/consent');
      return;
    }
    // Hedef grup + ilk landing route (admin grubunda index yok → planner'a git)
    const targetGroup = role === 'member' ? '(member)' : role === 'staff' ? '(staff)' : '(admin)';
    const landing =
      role === 'member' ? '/(member)' : role === 'staff' ? '/(staff)' : '/(admin)/planner';
    if (group !== targetGroup) router.replace(landing);
  }, [isInitializing, isAuthenticated, role, user, segments, router]);
}
