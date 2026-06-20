import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HamburgerButton } from './hamburger-button';
import { useResponsive } from '../lib/responsive';
import { colors } from '../theme/colors';

/**
 * Tüm sayfalarda ortak header — soldan hamburger + sola yaslı kalın başlık.
 * `right` ile sağa, `onBack` ile hamburger yerine geri butonu koyulabilir.
 */
export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const { contentMaxWidth, gutter } = useResponsive();
  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
      ]}
    >
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <HamburgerButton />
      )}
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
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
