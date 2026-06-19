import { StyleSheet, Text, View } from 'react-native';

import { HamburgerButton } from './hamburger-button';
import { useResponsive } from '../lib/responsive';
import { colors } from '../theme/colors';

/**
 * Tüm sayfalarda ortak header — soldan hamburger + sola yaslı kalın başlık
 * (Takvim ekranındaki stil). RoleShell içinde kullanılmalı.
 * `right` ile sağa eylem koyulabilir.
 */
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { contentMaxWidth, gutter } = useResponsive();
  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
      ]}
    >
      <HamburgerButton />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.spacer} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  spacer: { flex: 1 },
});
