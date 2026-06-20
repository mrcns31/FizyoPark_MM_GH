import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useDeleteStaff, useStaff } from '../api/hooks';

/** Personel listesi — kart + FAB ile ekle, modal form ile düzenle/sil. */
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
      <ScrollView contentContainerStyle={[styles.list, wide]}>
        {(data ?? []).length === 0 ? <Card><Muted>Personel yok.</Muted></Card> : null}
        {(data ?? []).map((s) => {
          const edit = () => router.push({ pathname: '/(admin)/more/staff-form', params: { id: String(s.id) } });
          return (
            <Pressable key={s.id} style={styles.card} onPress={edit}>
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={2}>{s.fullName}</Text>
                <View style={styles.headActions}>
                  <Pressable style={styles.iconBtn} hitSlop={6} onPress={edit}>
                    <Ionicons name="create-outline" size={16} color={colors.muted} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => onDelete(s.id, s.fullName)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.meta}>
                {s.phone ? <Text style={styles.metaText}>{s.phone}</Text> : null}
                {s.email ? <Text style={styles.metaText}>{s.email}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  name: { flex: 1, fontSize: 15, fontWeight: '750' as '700', color: colors.text },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.muted, marginRight: 8 },
});
