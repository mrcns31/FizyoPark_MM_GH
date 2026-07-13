import { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import { useFormerStaff, useReactivateStaff } from '../api/hooks';
import type { StaffMember } from '../api/staff';

function fmtDeletedAt(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('tr-TR');
}

function FormerStaffCard({
  s,
  onReactivate,
  busy,
}: {
  s: StaffMember;
  onReactivate: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.name} numberOfLines={2}>{s.fullName}</Text>
        <View style={styles.meta}>
          {s.phone ? <Text style={styles.metaText}>{s.phone}</Text> : null}
          <Text style={styles.metaText}>Silinme: {fmtDeletedAt(s.deletedAt)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.reactivateBtn} onPress={onReactivate} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.reactivateBtnText}>Tekrar Aktif Et</Text>}
      </TouchableOpacity>
    </View>
  );
}

/** Soft-silinmiş (eski) personel listesi — admin tekrar aktif edebilir. */
export function FormerStaffScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, isLoading } = useFormerStaff();
  const reactivate = useReactivateStaff();
  const { contentMaxWidth, gutter } = useResponsive();
  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  function onReactivate(s: StaffMember) {
    Alert.alert(
      'Tekrar Aktif Et',
      `${s.fullName} tekrar aktif edilsin mi?\n\nEski şifresi geçersiz olur; telefon son 4 hane geçici şifre olarak atanır, personel ilk girişte yeni şifre belirlemek zorunda kalır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Tekrar Aktif Et',
          onPress: () => {
            reactivate.mutate(s.id, {
              onSuccess: (result) => {
                Alert.alert(
                  'Tekrar Aktif Edildi',
                  `${s.fullName} tekrar aktif edildi.\n\nE-posta: ${result.loginUsername ?? '–'}\nGeçici şifre: ${result.temporaryPassword ?? '–'}\n\nPersoneli bu bilgilerle giriş yapmaya yönlendirin.`,
                );
              },
              onError: (e) => Alert.alert('Hata', (e as Error).message),
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Eski Personeller" onBack={() => router.back()} />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={[styles.list, wide]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Card><Muted>Eski personel yok.</Muted></Card>}
          renderItem={({ item: s }) => (
            <FormerStaffCard
              s={s}
              onReactivate={() => onReactivate(s)}
              busy={reactivate.isPending && reactivate.variables === s.id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    list: { paddingTop: 16, paddingBottom: 32, gap: 10, flexGrow: 1 },
    card: {
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.panel,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardInfo: { flex: 1 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    metaText: { fontSize: 12, color: colors.muted, marginRight: 8 },
    reactivateBtn: {
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      minWidth: 110,
      alignItems: 'center',
    },
    reactivateBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  });
}
