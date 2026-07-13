import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useDrawer } from './drawer/drawer-context';
import { useTheme } from '../features/theme';

/** Header'da drawer'ı açan hamburger butonu. RoleShell içinde kullanılmalı. */
export function HamburgerButton({ color }: { color?: string }) {
  const { colors } = useTheme();
  const { openDrawer } = useDrawer();
  return (
    <Pressable onPress={openDrawer} hitSlop={10} style={{ paddingHorizontal: 4 }}>
      <Ionicons name="menu" size={26} color={color ?? colors.text} />
    </Pressable>
  );
}
