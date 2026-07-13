import { useMemo, useRef } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import { toDateStr } from '../../../lib/datetime';
import { promptAdminPassword } from '../../../lib/admin-password';
import { getSessions } from '../../sessions/api/sessions';
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
          <Ionicons name="create-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeDelete}
          onPress={() => { swipeRef.current?.close(); onDelete(); }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.white} />
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data } = useStaff();
  const del = useDeleteStaff();
  const { contentMaxWidth, gutter } = useResponsive();

  async function promptDeletePassword(id: number, name: string) {
    const pw = await promptAdminPassword(`${name} silinecek. Admin şifresini girin:`);
    if (pw === null) return;
    del.mutate({ id, adminPassword: pw }, { onError: (e) => Alert.alert('Hata', (e as Error).message) });
  }

  async function onDelete(id: number, name: string) {
    try {
      const future = await getSessions({ staffId: id, startDate: toDateStr() });
      const futureCount = future.filter((s) => s.memberId != null).length;
      if (futureCount > 0) {
        Alert.alert(
          'Gelecek Randevu Uyarısı',
          `${name} personelinin bugünden itibaren ${futureCount} üyeli randevusu var.\n\nPersonel silinirse bu randevular takvimden silinmez, kendi adıyla görünmeye devam eder ama personele yeniden atanamaz.\n\nYine de silme işlemine devam etmek istiyor musunuz?`,
          [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Devam Et', style: 'destructive', onPress: () => promptDeletePassword(id, name) },
          ],
        );
        return;
      }
    } catch {
      // Kontrol başarısız olursa sessizce normal silme akışına devam et.
    }
    promptDeletePassword(id, name);
  }

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  const formerStaffBtn = (
    <Pressable
      onPress={() => router.push('/(admin)/more/staff-former')}
      hitSlop={10}
      style={styles.formerBtn}
    >
      <Ionicons name="people-outline" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Personel" onBack={() => router.push('/(admin)/more/settings')} right={formerStaffBtn} />
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

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    formerBtn: { padding: 6 },
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
}
