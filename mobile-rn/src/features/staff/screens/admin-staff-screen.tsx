import { useRef } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useDeleteStaff, useStaff } from '../api/hooks';
import type { StaffMember } from '../api/staff';

function StaffCard({
  s,
  onEdit,
  onDelete,
}: {
  s: StaffMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <TouchableOpacity
          style={styles.swipeEdit}
          onPress={() => { swipeRef.current?.close(); onEdit(); }}
        >
          <Ionicons name="create-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeDelete}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    >
      <View style={styles.card}>
        <Text style={styles.name} numberOfLines={2}>{s.fullName}</Text>
        <View style={styles.meta}>
          {s.phone ? <Text style={styles.metaText}>{s.phone}</Text> : null}
          {s.email ? <Text style={styles.metaText}>{s.email}</Text> : null}
        </View>
      </View>
    </Swipeable>
  );
}

/** Personel listesi — swipe düzenle/sil, FAB ile ekle. */
export function AdminStaffScreen() {
  const router = useRouter();
  const { data } = useStaff();
  const del = useDeleteStaff();
  const { contentMaxWidth, gutter } = useResponsive();

  function onDelete(id: number, name: string) {
    Alert.prompt(
      'Personeli sil',
      `${name} silinecek. Admin şifresini girin:`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: (pw?: string) =>
            del.mutate({ id, adminPassword: pw ?? '' }, { onError: (e) => Alert.alert('Hata', (e as Error).message) }),
        },
      ],
      'secure-text'
    );
  }

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Personel" onBack={() => router.push('/(admin)/more/settings')} />
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={[styles.list, wide]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Card><Muted>Personel yok.</Muted></Card>}
        renderItem={({ item: s }) => (
          <StaffCard
            s={s}
            onEdit={() => router.push({ pathname: '/(admin)/more/staff-form', params: { id: String(s.id) } })}
            onDelete={() => onDelete(s.id, s.fullName)}
          />
        )}
      />
      <Fab onPress={() => router.push('/(admin)/more/staff-form')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingTop: 16, paddingBottom: 96, gap: 10, flexGrow: 1 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaText: { fontSize: 12, color: colors.muted, marginRight: 8 },
  swipeEdit: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: 12,
    marginRight: 4,
  },
  swipeDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: 12,
    marginLeft: 4,
  },
});
