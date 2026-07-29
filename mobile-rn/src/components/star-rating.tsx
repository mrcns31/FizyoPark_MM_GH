import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../features/theme';
import type { AppColors } from '../theme/colors';

const LABELS = ['', 'Çok kötü', 'Kötü', 'Orta', 'İyi', 'Çok iyi'];

/**
 * 1-5 yıldız. onChange verilmezse salt okunur.
 * Puanlama zorunlu değil — boş hâli de geçerli bir durum.
 */
export function StarRating({
  value,
  onChange,
  size = 22,
  showLabel = false,
  disabled = false,
}: {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: number;
  showLabel?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const readOnly = !onChange || disabled;
  const current = value ?? 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= current;
          const star = (
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? colors.fpOrange : colors.textMuted}
            />
          );
          if (readOnly) return <View key={n} style={styles.star}>{star}</View>;
          return (
            <Pressable
              key={n}
              onPress={() => onChange?.(n)}
              hitSlop={6}
              style={styles.star}
              accessibilityRole="button"
              accessibilityLabel={`${n} yıldız`}
            >
              {star}
            </Pressable>
          );
        })}
      </View>
      {showLabel && current > 0 ? <Text style={styles.label}>{LABELS[current]}</Text> : null}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stars: { flexDirection: 'row', gap: 2 },
    star: { paddingHorizontal: 2 },
    label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  });
}
