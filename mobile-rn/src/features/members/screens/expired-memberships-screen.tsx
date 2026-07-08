import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { SearchField } from '../../../components/search-field';
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
  const [sortCol, setSortCol] = useState<'name' | 'start' | 'end'>('end');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function onSort(col: 'name' | 'start' | 'end') {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'name' ? 'asc' : 'desc'); }
  }

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

    const mult = sortDir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => {
      switch (sortCol) {
        case 'name':  return mult * a.name.localeCompare(b.name, 'tr');
        case 'start': return mult * (a.startDate || '').localeCompare(b.startDate || '');
        case 'end':   return mult * (a.endDate || '').localeCompare(b.endDate || '');
        default:      return 0;
      }
    });
  }, [rows, search, letter, sortCol, sortDir]);

  const { visible, hasMore, loadMore } = useIncremental(filtered, {
    step: 25,
    resetKey: `${search}|${letter ?? ''}|${sortCol}|${sortDir}`,
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
        <SearchField value={search} onChangeText={setSearch} placeholder="Ad, telefon, üye no ara" />
        <AlphaFilter value={letter} onChange={setLetter} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {([
            { col: 'name',  label: 'Ad/Soyad' },
            { col: 'start', label: 'Başlangıç' },
            { col: 'end',   label: 'Bitiş' },
          ] as const).map(({ col, label }) => {
            const isActive = sortCol === col;
            return (
              <Pressable key={col} style={[styles.sortChip, isActive && styles.sortChipOn]} onPress={() => onSort(col)}>
                <Text style={[styles.sortChipText, isActive && styles.sortChipTextOn]}>
                  {label}{isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.countText}>{filtered.length} üye</Text>
        </ScrollView>
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
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sortChipOn: { borderColor: 'rgba(124,92,255,0.5)', backgroundColor: 'rgba(124,92,255,0.15)' },
  sortChipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  sortChipTextOn: { color: colors.text },
  countText: { fontSize: 12, color: colors.muted, paddingHorizontal: 6, alignSelf: 'center' },
});
