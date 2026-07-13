import { useMemo } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

/**
 * Arama kutucuğu — sağında X (temizle) butonu.
 * TextInput props'larını geçirir; value doluysa X görünür.
 */
export function SearchField({
  value,
  onChangeText,
  style,
  ...rest
}: TextInputProps & { onChangeText: (v: string) => void }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  return (
    <View style={[styles.wrap, style as any]}>
      <Ionicons name="search-outline" size={16} color={colors.muted} style={styles.icon} />
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={colors.textMuted ?? colors.muted}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} style={styles.clear}>
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: surfaceTint(theme, 0.05),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      gap: 6,
    },
    icon: { flexShrink: 0 },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      paddingVertical: 8,
    },
    clear: { flexShrink: 0 },
  });
}
