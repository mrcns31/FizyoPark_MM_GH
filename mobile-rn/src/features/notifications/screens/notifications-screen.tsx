import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useMarkNotificationRead, useNotifications } from '../api/hooks';
import type { StaffNotification } from '../api/notifications';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'cancel', label: 'İptaller' },
  { key: 'checkin', label: 'Check-in' },
] as const;
type Filter = (typeof FILTERS)[number]['key'];

/** Bildirim listesi (personel/yönetici). Tümü/İptaller/Check-in filtresi; okununca işaretlenir. */
export function NotificationsScreen() {
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { contentMaxWidth, gutter } = useResponsive();
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(
    () => (data ?? []).filter((n) => filter === 'all' || n.type === filter),
    [data, filter],
  );

  const wide = { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Bildirimler" />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Bildirimler" />
      <View style={[styles.filters, wide]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipOn]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(n) => String(n.id)}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={[styles.list, wide]}
        ListEmptyComponent={
          <Card>
            <Muted>Bildirim yok.</Muted>
          </Card>
        }
        renderItem={({ item }: { item: StaffNotification }) => (
          <Pressable onPress={() => !item.readAt && markRead.mutate(item.id)}>
            <Card style={!item.readAt ? styles.unread : undefined}>
              <View style={styles.row}>
                {!item.readAt ? <View style={styles.dot} /> : null}
                <Text style={styles.title}>{item.title}</Text>
              </View>
              {item.body ? <Muted>{item.body}</Muted> : null}
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundTop },
  filters: { flexDirection: 'row', gap: 8, paddingTop: 6, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.text },
  list: { paddingVertical: 12, gap: 10 },
  unread: { borderColor: 'rgba(124,92,255,0.45)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  title: { fontSize: 15, fontWeight: '700', color: colors.white, flex: 1 },
});
