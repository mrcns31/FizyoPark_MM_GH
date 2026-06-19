import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Tek paylaşılan QueryClient. Web'deki readCache/writeCache (TTL'li manuel cache)
 * mantığının yerini react-query'nin staleTime/gcTime'ı tutar.
 *
 * Realtime: web 20–60 sn'de bir polluyor + sekme öne gelince anında senkron.
 * RN'de aynı his için (a) ilgili hook'larda refetchInterval, (b) uygulama öne
 * gelince focusManager üzerinden otomatik refetch (refetchOnWindowFocus).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// React Native'de "pencere odağı" = uygulama foreground. AppState'i focusManager'a
// bağla; arka plandayken refetchInterval'lar duraklar (refetchIntervalInBackground=false),
// öne gelince stale sorgular yenilenir.
AppState.addEventListener('change', (status: AppStateStatus) => {
  focusManager.setFocused(status === 'active');
});
