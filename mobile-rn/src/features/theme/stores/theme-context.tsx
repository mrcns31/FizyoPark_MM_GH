import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { palettes, type AppColors, type ResolvedTheme, type ThemeMode } from '../../../theme/colors';

const MODE_KEY = 'fp:theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: AppColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Tema tercihini yönetir:
 *  - 'system' iken cihazın açık/koyu ayarını takip eder
 *  - kullanıcı 'light'/'dark' seçerse tercih AsyncStorage'da kalıcı olarak saklanır
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Açılışta kaydedilmiş tercihi oku
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(MODE_KEY).then((saved) => {
      if (active && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setModeState(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  const systemResolved: ResolvedTheme = (systemScheme ?? Appearance.getColorScheme()) === 'light' ? 'light' : 'dark';
  const resolvedTheme: ResolvedTheme = mode === 'system' ? systemResolved : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      colors: palettes[resolvedTheme],
      setMode,
    }),
    [mode, resolvedTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
