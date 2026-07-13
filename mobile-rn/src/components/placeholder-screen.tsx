import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme';
import type { AppColors } from '../theme/colors';
import { ScreenContainer } from './screen-container';

/** Henüz yapılmamış ekranlar için geçici içerik. */
export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScreenContainer center>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note ?? 'Bu ekran yakında'}</Text>
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    title: { fontSize: 20, fontWeight: '700', color: colors.white },
    note: { fontSize: 14, color: colors.textMuted },
  });
}
