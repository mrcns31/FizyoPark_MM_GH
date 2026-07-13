import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchField } from '../../../components/search-field';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { Card, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useIncremental } from '../../../lib/use-incremental';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import type { Member } from '../../../types/api';
import { useDeleteMember, useMembers } from '../api/hooks';
import { useMemberPackages } from '../../member-packages/api/hooks';

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function remainingColor(remaining: number | null, total: number, mutedColor: string): string {
  if (remaining == null || total <= 0) return mutedColor;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  if (ratio >= 1) return '#4cd473';
  if (ratio >= 0.5) return `hsl(${Math.round(30 + ((ratio - 0.5) / 0.5) * 90)}, 75%, 60%)`;
  if (ratio >= 0.2) return `hsl(${Math.round(((ratio - 0.2) / 0.3) * 30)}, 75%, 60%)`;
  return '#f25c6e';
}

/** Admin üye listesi — sadece aktif paketliler + paketsiz uyarı kutusu. */
export function AdminMembersScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const router = useRouter();
  const { data, isLoading, refetch } = useMembers();
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { data: allPackages } = useMemberPackages();
  const del = useDeleteMember();
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<'name' | 'start' | 'end' | 'remaining'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { contentMaxWidth, gutter, columns } = useResponsive();

  function onSort(col: 'name' | 'start' | 'end' | 'remaining') {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  const activeByMember = useMemo(() => {
    const map = new Map<number, { id: number; packageName: string; startDate: string; endDate: string; lessonCount: number; remainingSessions: number | null }>();
    for (const mp of allPackages ?? []) {
      if (mp.status === 'active') map.set(mp.memberId, mp);
    }
    return map;
  }, [allPackages]);

  const memberIdsWithAnyPackage = useMemo(() => {
    const set = new Set<number>();
    for (const mp of allPackages ?? []) set.add(mp.memberId);
    return set;
  }, [allPackages]);

  const { withActive, withoutAny } = useMemo(() => {
    const all = data ?? [];
    const term = q.trim().toLowerCase();
    let active = all.filter((m) => activeByMember.has(m.id));
    if (term) active = active.filter((m) => m.name.toLowerCase().includes(term) || m.phone.includes(term) || m.memberNo.toLowerCase().includes(term));
    if (letter) active = active.filter((m) => nameStartsWithLetter(m.name, letter));

    const mult = sortDir === 'asc' ? 1 : -1;
    active = [...active].sort((a, b) => {
      const mpA = activeByMember.get(a.id);
      const mpB = activeByMember.get(b.id);
      switch (sortCol) {
        case 'name':      return mult * a.name.localeCompare(b.name, 'tr');
        case 'start':     return mult * (mpA?.startDate ?? '').localeCompare(mpB?.startDate ?? '');
        case 'end':       return mult * (mpA?.endDate ?? '').localeCompare(mpB?.endDate ?? '');
        case 'remaining': return mult * ((mpA?.remainingSessions ?? 0) - (mpB?.remainingSessions ?? 0));
        default:          return 0;
      }
    });

    return {
      withActive: active,
      withoutAny: all.filter((m) => !memberIdsWithAnyPackage.has(m.id)),
    };
  }, [data, activeByMember, memberIdsWithAnyPackage, q, letter, sortCol, sortDir]);

  const { visible, hasMore, loadMore } = useIncremental(withActive, {
    step: 25,
    resetKey: `${q}|${letter ?? ''}|${sortCol}|${sortDir}`,
  });

  function onMemberPress(memberId: number) {
    const active = activeByMember.get(memberId);
    if (active) {
      router.push({
        pathname: '/(admin)/members/package-sessions',
        params: { memberPackageId: String(active.id), packageName: active.packageName, startDate: active.startDate, endDate: active.endDate, packageStatus: 'active', memberId: String(memberId) },
      });
    } else {
      router.push({ pathname: '/(admin)/members/member-packages', params: { memberId: String(memberId) } });
    }
  }

  function promptPassword(id: number, name: string, deleteHistory: boolean) {
    Alert.prompt(
      'Admin şifresi',
      `${name}${deleteHistory ? ' geçmişiyle birlikte' : ''} silinecek. Onaylamak için admin şifresini girin:`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: (adminPassword?: string) =>
            del.mutate(
              { id, adminPassword: adminPassword ?? '', deleteHistory },
              { onError: (e) => Alert.alert('Hata', (e as Error).message) },
            ),
        },
      ],
      'secure-text',
    );
  }

  function onDelete(id: number, name: string) {
    Alert.alert(
      'Üyeyi sil',
      `${name} silinecek. Paket ve seans geçmişi de silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Geçmişi koru', onPress: () => promptPassword(id, name, false) },
        { text: 'Geçmişiyle sil', style: 'destructive', onPress: () => promptPassword(id, name, true) },
      ],
    );
  }

  function renderCard(item: Member) {
    const active = activeByMember.get(item.id);
    const lowSessions = active != null && active.remainingSessions != null && active.remainingSessions <= 4;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, columns > 1 ? { flex: 1 } : undefined, pressed && styles.cardPressed]}
        onPress={() => onMemberPress(item.id)}
      >
        <View style={styles.head}>
          <View style={styles.nameWrap}>
            <Text style={[styles.name, lowSessions && styles.nameLow]} numberOfLines={2}>{item.name}</Text>
            {lowSessions ? <View style={styles.nameLine} /> : null}
            {item.memberNo ? <Text style={styles.memberNo}>No: {item.memberNo}</Text> : null}
            {item.deletionRequestedAt ? (
              <View style={styles.delBadge}>
                <Text style={styles.delBadgeText}>İptal talebi</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headActions}>
            <Pressable style={styles.iconBtn} hitSlop={8} onPress={(e) => { e.stopPropagation?.(); router.push({ pathname: '/(admin)/members/form', params: { id: String(item.id) } }); }}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
            </Pressable>
            <Pressable style={styles.iconBtn} hitSlop={8} onPress={(e) => { e.stopPropagation?.(); router.push({ pathname: '/(admin)/members/member-packages', params: { memberId: String(item.id) } }); }}>
              <Ionicons name="cube-outline" size={18} color={colors.muted} />
            </Pressable>
            <Pressable style={styles.iconBtn} hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onDelete(item.id, item.name); }}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        <View style={styles.meta}>
          {item.phone ? <Text style={styles.metaText}>{item.phone}</Text> : null}
          {active ? <Text style={styles.metaText} numberOfLines={1}>{active.packageName}</Text> : null}
        </View>

        {active ? (
          <View style={styles.dates}>
            <Text style={styles.metaText}>{fmtDate(active.startDate)} – {fmtDate(active.endDate)}</Text>
            <Text style={[styles.remainingText, { color: remainingColor(active.remainingSessions, active.lessonCount, colors.muted) }]}>
              Kalan: {active.remainingSessions ?? '–'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  const wide = { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Üyeler" />
      <View style={[styles.searchWrap, wide]}>
        <SearchField
          placeholder="Üye ara (isim, telefon, no)"
          value={q}
          onChangeText={setQ}
        />
        <AlphaFilter value={letter} onChange={setLetter} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {([
            { col: 'name',      label: 'Ad/Soyad' },
            { col: 'start',     label: 'Başlangıç' },
            { col: 'end',       label: 'Bitiş' },
            { col: 'remaining', label: 'Kalan' },
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
          <Text style={styles.countText}>{withActive.length} üye</Text>
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={columns}
          data={visible}
          keyExtractor={(m) => String(m.id)}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 12, justifyContent: 'space-between' } : undefined}
          refreshing={manualRefreshing}
          onRefresh={async () => { setManualRefreshing(true); try { await refetch(); } finally { setManualRefreshing(false); } }}
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={[styles.list, wide]}
          ListHeaderComponent={
            withoutAny.length > 0 ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>
                  ⚠ Paketsiz üyeler ({withoutAny.length}) — paket atamak için isme tıklayın
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.warningChips}>
                  {withoutAny.map((m) => (
                    <Pressable
                      key={m.id}
                      style={styles.warningChip}
                      onPress={() => router.push({ pathname: '/(admin)/members/member-packages', params: { memberId: String(m.id) } })}
                    >
                      <Text style={styles.warningChipText}>{m.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={<Card><Muted>Aktif paketi olan üye bulunamadı.</Muted></Card>}
          renderItem={({ item }) => renderCard(item)}
        />
      )}
      <Fab onPress={() => router.push('/(admin)/members/form')} />
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.backgroundTop },
    searchWrap: { paddingVertical: 10, gap: 6 },
    search: {
      backgroundColor: surfaceTint(theme, 0.03),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 16,
    },
    list: { paddingTop: 8, paddingBottom: 96, gap: 10 },
    warningBox: {
      borderWidth: 1,
      borderColor: 'rgba(255,77,109,0.5)',
      borderRadius: 10,
      backgroundColor: 'rgba(255,77,109,0.08)',
      padding: 12,
      marginBottom: 10,
      gap: 10,
    },
    warningTitle: { color: colors.danger, fontSize: 13, fontWeight: '700' },
    warningChips: { gap: 8 },
    warningChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,77,109,0.5)',
    },
    warningChipText: { color: colors.danger, fontSize: 13 },
    card: {
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: surfaceTint(theme, 0.03),
      gap: 6,
    },
    cardPressed: { backgroundColor: 'rgba(124,92,255,0.07)', borderColor: 'rgba(124,92,255,0.25)' },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
    nameWrap: { flex: 1, minWidth: 0, gap: 3 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text },
    nameLow: { color: '#FF6B35' },
    nameLine: { height: 2, backgroundColor: '#FF6B35', borderRadius: 1, marginTop: 2 },
    memberNo: { fontSize: 11, color: colors.muted },
    delBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(255,107,122,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,107,122,0.28)',
    },
    delBadgeText: { color: '#ff8a96', fontSize: 11, fontWeight: '700' },
    headActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    metaText: { fontSize: 12, color: colors.muted },
    remainingText: { fontSize: 12, fontWeight: '700' },
    dates: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
    sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sortChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
    },
    sortChipOn: { borderColor: 'rgba(124,92,255,0.5)', backgroundColor: 'rgba(124,92,255,0.15)' },
    sortChipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
    sortChipTextOn: { color: colors.text },
    countText: { fontSize: 12, color: colors.muted, paddingHorizontal: 6, alignSelf: 'center' },
  });
}
