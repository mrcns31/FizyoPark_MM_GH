import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme } from '../features/theme';
import type { AppColors } from '../theme/colors';

/** Modal (bottom sheet) başlığındaki Kapat (X) butonu. */
export function ModalCloseButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={10} style={{ paddingHorizontal: 4 }}>
      <Ionicons name="close" size={26} color={colors.text} />
    </Pressable>
  );
}

/**
 * Ekle/düzenle formları için native sheet sunumu (alttan kayan, swipe-to-dismiss).
 * Koyu header + Kapat butonu.
 */
export function makeModalScreenOptions(colors: AppColors) {
  return {
    presentation: 'modal' as const,
    headerShown: true,
    headerStyle: { backgroundColor: colors.panel },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text, fontWeight: '700' as const },
    headerLeft: () => <ModalCloseButton />,
    contentStyle: { backgroundColor: colors.bg },
  };
}
