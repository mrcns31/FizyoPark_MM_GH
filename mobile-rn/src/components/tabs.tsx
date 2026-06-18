import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

import { colors } from '../theme/colors';

/** Tüm rol tab'larında ortak koyu tema. */
export const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.backgroundTop },
  headerTitleStyle: { color: colors.white, fontWeight: '700' as const },
  headerTintColor: colors.white,
  tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.textMuted,
};

/** İç içe stack'lerde ortak koyu header. */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.backgroundTop },
  headerTitleStyle: { color: colors.white, fontWeight: '700' as const },
  headerTintColor: colors.white,
  contentStyle: { backgroundColor: colors.backgroundTop },
};

/** Tab ikonu üretici. color react-navigation'dan ColorValue gelir. */
export function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}
