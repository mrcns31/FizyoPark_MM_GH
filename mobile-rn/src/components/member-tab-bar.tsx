import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

/** expo-router/@react-navigation tipleri çakışıyor; gerekli alanları yerel tanımla. */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

/** Üye alt barı — 2 sekme (Seanslar · Profil) + ortada büyük QR FAB. */
const LEFT: { name: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'index', label: 'Seanslar', icon: 'calendar' },
];
const RIGHT: { name: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'profile', label: 'Profil', icon: 'person' },
];

export function MemberTabBar({ state, navigation }: TabBarProps) {
  const current = state.routes[state.index]?.name;

  function go(name: string) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(name);
  }

  const left = LEFT;
  const right = RIGHT;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.bar}>
        {left.map((t) => (
          <TabBtn key={t.name} {...t} active={current === t.name} onPress={() => go(t.name)} />
        ))}

        <Pressable style={styles.fab} onPress={() => go('qr')}>
          <Ionicons name="qr-code" size={26} color="#fff" />
        </Pressable>

        {right.map((t) => (
          <TabBtn key={t.name} {...t} active={current === t.name} onPress={() => go(t.name)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

function TabBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Ionicons name={icon} size={22} color={active ? colors.accent : colors.muted} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#0c1226' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0c1226',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  tabLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  tabLabelActive: { color: colors.accent },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginHorizontal: 6,
    marginTop: -22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#0c1226',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
});
