import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ALL_ITEMS: { label: string; icon: IoniconName; path: string; tabletOnly?: boolean }[] = [
  { label: 'Paket Tanımlama',    icon: 'cube',             path: '/(admin)/packages' },
  { label: 'Paket Süresi Güncelle', icon: 'hourglass-outline', path: '/(admin)/more/extend-package' },
  { label: 'Personel',           icon: 'people-circle',    path: '/(admin)/more/staff' },
  { label: 'Odalar / Alet',      icon: 'business',         path: '/(admin)/more/rooms',             tabletOnly: true },
  { label: 'Çalışma Saatleri',   icon: 'time',             path: '/(admin)/more/working-hours',     tabletOnly: true },
  { label: 'Kapalı Günler',      icon: 'calendar-clear',   path: '/(admin)/more/closure-days',      tabletOnly: true },
  { label: 'İşlem Logları',      icon: 'list-outline',     path: '/(admin)/more/activity-logs',     tabletOnly: true },
  { label: 'Hesabım',            icon: 'person-circle',    path: '/(admin)/more/account' },
];

/** Ayarlar hub — web admin "Ayarlar" modalıyla birebir; yönetim ekranlarına giriş. */
export function SettingsHubScreen() {
  const router = useRouter();
  const { contentMaxWidth, gutter, isTablet } = useResponsive();
  const items = ALL_ITEMS.filter((it) => !it.tabletOnly || isTablet);

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Ayarlar" />
      <ScrollView contentContainerStyle={[styles.list, wide]} showsVerticalScrollIndicator={false}>
        {items.map((it) => (
          <Pressable key={it.path} style={styles.row} onPress={() => router.push(it.path as never)}>
            <View style={styles.icon}>
              <Ionicons name={it.icon} size={20} color={colors.accent} />
            </View>
            <Text style={styles.label}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingVertical: 16, gap: 10, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(124,92,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
});
