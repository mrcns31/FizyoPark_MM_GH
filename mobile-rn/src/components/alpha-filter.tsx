import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

// Web `initAlphaFilterBar` ile aynı Türkçe alfabe.
export const TR_LETTERS = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L',
  'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z',
];

/** İsmin baş harfi verilen harfle eşleşiyor mu (Türkçe locale, İ/I ayrımı). */
export function nameStartsWithLetter(name: string, letter: string): boolean {
  const first = (name || '').trim().charAt(0).toLocaleUpperCase('tr-TR');
  return first === letter;
}

/** A-Z harf filtre çubuğu (yatay kaydırılır). `Tümü` = null seçim. */
export function AlphaFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (letter: string | null) => void;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pressable
        style={[styles.chip, value === null && styles.chipActive]}
        onPress={() => onChange(null)}
      >
        <Text style={[styles.chipText, value === null && styles.chipTextActive]}>Tümü</Text>
      </Pressable>
      {TR_LETTERS.map((l) => (
        <Pressable
          key={l}
          style={[styles.chip, value === l && styles.chipActive]}
          onPress={() => onChange(value === l ? null : l)}
        >
          <Text style={[styles.chipText, value === l && styles.chipTextActive]}>{l}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    row: { gap: 6, paddingVertical: 2, paddingRight: 8 },
    chip: {
      minWidth: 34,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
    chipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: colors.text },
  });
}
