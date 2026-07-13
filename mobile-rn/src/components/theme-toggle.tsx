import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../features/theme';
import type { AppColors, ThemeMode } from '../theme/colors';

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'Açık', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Koyu', icon: 'moon-outline' },
  { mode: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
];

/** Açık / Koyu / Sistem seçimi sunan paylaşılan 3'lü segment kontrolü. */
export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = mode === opt.mode;
        return (
          <Pressable
            key={opt.mode}
            onPress={() => setMode(opt.mode)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Ionicons name={opt.icon} size={16} color={active ? colors.accent : colors.muted} />
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: colors.panel2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius2,
      padding: 4,
    },
    item: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: colors.radius2 - 2,
    },
    itemActive: { backgroundColor: colors.accentSoft },
    label: { fontSize: 12, fontWeight: '600', color: colors.muted },
    labelActive: { color: colors.accent },
  });
}
