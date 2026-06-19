import { StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { ScreenContainer } from './screen-container';

/** Henüz yapılmamış ekranlar için geçici içerik. */
export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  return (
    <ScreenContainer center>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note ?? 'Bu ekran yakında'}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.white },
  note: { fontSize: 14, color: colors.textMuted },
});
