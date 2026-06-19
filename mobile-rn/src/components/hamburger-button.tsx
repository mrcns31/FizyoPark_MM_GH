import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useDrawer } from './drawer/drawer-context';
import { colors } from '../theme/colors';

/** Header'da drawer'ı açan hamburger butonu. RoleShell içinde kullanılmalı. */
export function HamburgerButton({ color = colors.text }: { color?: string }) {
  const { openDrawer } = useDrawer();
  return (
    <Pressable onPress={openDrawer} hitSlop={10} style={{ paddingHorizontal: 4 }}>
      <Ionicons name="menu" size={26} color={color} />
    </Pressable>
  );
}
