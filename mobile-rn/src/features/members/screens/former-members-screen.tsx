import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { FormField } from '../../../components/form';
import { Badge, Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { SheetModal } from '../../../components/sheet-modal';
import { useIncremental } from '../../../lib/use-incremental';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useFormerMemberPackages, useFormerMembers, useReactivateMember } from '../api/hooks';

function fmtDeletedAt(v: string | null): string {
  if (!v) return '–';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '–';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function fmtDate(v: string): string {
  if (!v) return '–';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function pkgStatusTone(s: string): 'green' | 'neutral' | 'red' {
  if (s === 'active') return 'green';
  if (s === 'cancelled') return 'red';
  return 'neutral';
}
function pkgStatusLabel(s: string): string {
  if (s === 'active') return 'Aktif';
  if (s === 'completed') return 'Tamamlandı';
  if (s === 'cancelled') return 'İptal';
  return s;
}

function PackagesSheet({
  memberId,
  memberName,
  onClose,
}: {
  memberId: number | null;
  memberName: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useFormerMemberPackages(memberId);
  const router = useRouter();

  return (
    <SheetModal visible={memberId != null} onClose={onClose}>
      <View style={sheetStyles.container}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.title} numberOfLines={1}>
          {memberName} — Geçmiş Paketler
        </Text>
        {isLoading ? (
          <Muted>Yükleniyor…</Muted>
        ) : !data || data.length === 0 ? (
          <Muted>Geçmiş paket kaydı yok.</Muted>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.list}>
            {data.map((pkg) => (
              <Pressable
                key={pkg.id}
                style={sheetStyles.pkgRow}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: '/(admin)/members/package-sessions',
                    params: {
                      memberPackageId: String(pkg.id),
                      packageName: pkg.packageName,
                      startDate: pkg.startDate,
                      endDate: pkg.endDate,
                      packageStatus: pkg.status,
                    },
                  });
                }}
              >
                <View style={sheetStyles.pkgLeft}>
                  <Text style={sheetStyles.pkgName}>{pkg.packageName}</Text>
                  <Text style={sheetStyles.pkgMeta}>
                    {fmtDate(pkg.startDate)} – {fmtDate(pkg.endDate)} · {pkg.lessonCount} ders
                  </Text>
                </View>
                <View style={sheetStyles.pkgRight}>
                  <Badge label={pkgStatusLabel(pkg.status)} tone={pkgStatusTone(pkg.status)} />
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Pressable style={sheetStyles.closeBtn} onPress={onClose}>
          <Text style={sheetStyles.closeTxt}>Kapat</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}

/** Eski Üyeler — iptal/silinmiş üyeler. Web `renderFormerMembersTable` (kart uyarlaması). */
export function FormerMembersScreen() {
  const { data, isLoading } = useFormerMembers();
  const reactivate = useReactivateMember();
  const { contentMaxWidth, gutter } = useResponsive();

  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [pkgSheetMemberId, setPkgSheetMemberId] = useState<number | null>(null);
  const [pkgSheetMemberName, setPkgSheetMemberName] = useState('');

  const list = useMemo(() => {
    let l = data ?? [];
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (q) {
      l = l.filter(
        (m) =>
          m.name.toLocaleLowerCase('tr-TR').includes(q) ||
          m.phone.includes(q) ||
          m.memberNo.toLocaleLowerCase('tr-TR').includes(q),
      );
    }
    if (letter) l = l.filter((m) => nameStartsWithLetter(m.name, letter));
    return [...l].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [data, search, letter]);

  const { visible, hasMore, loadMore } = useIncremental(list, {
    step: 25,
    resetKey: `${search}|${letter ?? ''}`,
  });

  function onReactivate(id: number, name: string) {
    Alert.alert(
      'Tekrar aktif et',
      `${name} tekrar aktif edilsin mi?\n\nAynı üye numarası ve paket/seans geçmişi korunur; aktif paketler sonlandırılır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Aktif Et',
          onPress: () =>
            reactivate.mutate(id, {
              onSuccess: (m) =>
                Alert.alert(
                  'Yeniden aktif edildi',
                  `${m.memberNo || name} yeniden aktif edildi. Aktif paketler sonlandırıldı; giriş şifresi telefon son 4 hane olarak sıfırlandı.`,
                ),
              onError: (e) => Alert.alert('Hata', (e as Error).message),
            }),
        },
      ],
    );
  }

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Eski Üyeler" />
      <View style={[styles.filters, wide]}>
        <FormField label="" value={search} onChangeText={setSearch} placeholder="Ad, telefon, üye no ara" />
        <AlphaFilter value={letter} onChange={setLetter} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={[styles.list, wide]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !isLoading ? (
            <Card>
              <Muted>
                {(data ?? []).length === 0 ? 'Eski üye kaydı yok.' : 'Filtreye uyan kayıt yok.'}
              </Muted>
            </Card>
          ) : null
        }
        renderItem={({ item: m }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              setPkgSheetMemberId(m.id);
              setPkgSheetMemberName(m.name);
            }}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.name} numberOfLines={1}>
                {m.name}
              </Text>
              <View style={styles.metaRow}>
                {m.memberNo ? <Text style={styles.meta}>No: {m.memberNo}</Text> : null}
                {m.phone ? <Text style={styles.meta}>{m.phone}</Text> : null}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>İptal: {fmtDeletedAt(m.deletedAt)}</Text>
                {m.packageCount != null ? (
                  <Text style={styles.meta}>{m.packageCount} paket</Text>
                ) : null}
                {m.sessionCount != null ? (
                  <Text style={styles.meta}>{m.sessionCount} seans</Text>
                ) : null}
              </View>
            </View>
            <Pressable
              style={styles.reactivateBtn}
              onPress={(e) => { e.stopPropagation?.(); onReactivate(m.id, m.name); }}
              disabled={reactivate.isPending}
            >
              <Ionicons name="refresh" size={16} color={colors.accent} />
              <Text style={styles.reactivateText}>Aktif Et</Text>
            </Pressable>
          </Pressable>
        )}
      />
      <PackagesSheet
        memberId={pkgSheetMemberId}
        memberName={pkgSheetMemberName}
        onClose={() => setPkgSheetMemberId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filters: { gap: 8, paddingTop: 4, paddingBottom: 8 },
  list: { paddingBottom: 24, gap: 10, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardLeft: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { fontSize: 12, color: colors.muted },
  reactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.5)',
    backgroundColor: 'rgba(124,92,255,0.20)',
  },
  reactivateText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});

const sheetStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  list: { maxHeight: 360 },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pkgLeft: { flex: 1, gap: 3 },
  pkgRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pkgName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pkgMeta: { color: colors.muted, fontSize: 12 },
  closeBtn: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  closeTxt: { color: colors.muted, fontSize: 14, fontWeight: '600' },
});
