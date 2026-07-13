import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import type { AppColors } from '../theme/colors';

/** Tüm rol tab'larında ortak koyu tema. */
export function makeTabScreenOptions(colors: AppColors) {
  return {
    headerStyle: { backgroundColor: colors.backgroundTop },
    headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
    headerTintColor: colors.text,
    tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.textMuted,
  };
}

/** İç içe stack'lerde ortak header. */
export function makeStackScreenOptions(colors: AppColors) {
  return {
    headerStyle: { backgroundColor: colors.backgroundTop },
    headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
    headerTintColor: colors.text,
    contentStyle: { backgroundColor: colors.backgroundTop },
  };
}

/** Tab ikonu üretici. color react-navigation'dan ColorValue gelir. */
export function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}
