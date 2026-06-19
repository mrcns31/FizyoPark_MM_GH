import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { FormField } from '../../../components/form';
import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useIncremental } from '../../../lib/use-incremental';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useMemberPackages } from '../../member-packages/api/hooks';
import { useMembers } from '../api/hooks';

function fmtTR(v: string): string {
  if (!v) return '–';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

interface Row {
  memberId: number;
  name: string;
  memberNo: string;
  phone: string;
  startDate: string;
  endDate: string;
  packageName: string;
  packageCount: number;
}

/** Paketi Bitmiş Üyeler — aktif paketi olmayıp geçmiş paketi olan üyeler (web `renderExpiredMembershipsTable`). */
export function ExpiredMembershipsScreen() {
  const router = useRouter();
  const { data: members } = useMembers();
  const { data: allPackages } = useMemberPackages();
  const { contentMaxWidth, gutter } = useResponsive();

  const [search, setSearch] = useState('');
  const [letter, setLetter] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    if (!members || !allPackages) return [];
    const byMember = new Map<number, typeof allPackages>();
    for (const mp of allPackages) {
      const arr = byMember.get(mp.memberId) ?? [];
      arr.push(mp);
      byMember.set(mp.memberId, arr);
    }
    const out: Row[] = [];
    for (const [memberId, pkgs] of byMember) {
      const hasActive = pkgs.some((p) => p.status === 'active');
      if (hasActive) continue;
      const latest = [...pkgs].sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''))[0];
      if (!latest) continue;
      const m = members.find((x) => x.id === memberId);
      out.push({
        memberId,
        name: m?.name ?? `Üye #${memberId}`,
        memberNo: m?.memberNo ?? '',
        phone: m?.phone ?? '',
        startDate: latest.startDate,
        endDate: latest.endDate,
        packageName: latest.packageName,
        packageCount: pkgs.length,
      });
    }
    return out;
  }, [members, allPackages]);

  const filtered = useMemo(() => {
    let l = rows;
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (q) {
      l = l.filter(
        (r) =>
          r.name.toLocaleLowerCase('tr-TR').includes(q) ||
          r.phone.includes(q) ||
          r.memberNo.toLocaleLowerCase('tr-TR').includes(q),
      );
    }
    if (letter) l = l.filter((r) => nameStartsWithLetter(r.name, letter));
    return [...l].sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''));
  }, [rows, search, letter]);

  const { visible, hasMore, loadMore } = useIncremental(filtered, {
    step: 25,
    resetKey: `${search}|${letter ?? ''}`,
  });

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Paketi Bitmiş Üyeler" />
      <View style={[styles.filters, wide]}>
        <FormField label="" value={search} onChangeText={setSearch} placeholder="Ad, telefon, üye no ara" />
        <AlphaFilter value={letter} onChange={setLetter} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(r) => String(r.memberId)}
        contentContainerStyle={[styles.list, wide]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Card>
            <Muted>
              {rows.length === 0
                ? 'Paketi bitmiş (bitiş tarihi geçmiş) kayıt yok.'
                : 'Filtreye uyan kayıt yok.'}
            </Muted>
          </Card>
        }
        renderItem={({ item: r }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/(admin)/members/member-packages',
                params: { memberId: String(r.memberId) },
              })
            }
          >
            <View style={styles.cardLeft}>
              <Text style={styles.name} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.metaRow}>
                {r.memberNo ? <Text style={styles.meta}>No: {r.memberNo}</Text> : null}
                {r.phone ? <Text style={styles.meta}>{r.phone}</Text> : null}
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Son paket: {r.packageName || '—'}</Text>
                {r.packageCount > 1 ? <Text style={styles.meta}>(+{r.packageCount - 1})</Text> : null}
              </View>
              <Text style={styles.meta}>
                {fmtTR(r.startDate)} – {fmtTR(r.endDate)} bitti
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={styles.iconBtn}
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push({ pathname: '/(admin)/members/form', params: { id: String(r.memberId) } });
                }}
              >
                <Ionicons name="person-outline" size={18} color={colors.muted} />
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push({ pathname: '/(admin)/members/member-packages', params: { memberId: String(r.memberId) } });
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              </Pressable>
            </View>
          </Pressable>
        )}
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
