import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useDrawer } from './drawer/drawer-context';
import { useTheme } from '../features/theme';

/** Header'da drawer'ı açan hamburger butonu. RoleShell içinde kullanılmalı. */
export function HamburgerButton({ color }: { color?: string }) {
  const { colors } = useTheme();
  const { openDrawer, hasBadge } = useDrawer();
  return (
    <Pressable onPress={openDrawer} hitSlop={10} style={{ paddingHorizontal: 4 }}>
      <View>
        <Ionicons name="menu" size={26} color={color ?? colors.text} />
        {hasBadge ? <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.bg }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
