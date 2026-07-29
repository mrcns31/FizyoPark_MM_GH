import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

/**
 * Profil ekranlarındaki gezinme satırı — ikon + etiket + (rozet) + ok.
 * Uzun formları kart içinde açık tutmak yerine bunun arkasına (bottom sheet) alıyoruz.
 */
export function NavRow({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={styles.navLabel}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.navBadge}>
          <Text style={styles.navBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
    },
    navLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
    navBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 5, marginRight: 4,
    },
    navBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  });
}
