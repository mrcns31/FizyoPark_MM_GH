import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import {
  dayHeaderLabel,
  endOfMonthTs,
  enumerateDays,
  formatDayLabel,
  formatDayShort,
  formatSessionRange,
  monthLabel,
  startOfMonthTs,
  startOfWeekTs,
  toDateStr,
} from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useStaff } from '../../staff/api/hooks';
import { useRooms } from '../../rooms/api/hooks';
import { staffColor } from '../../../lib/staff-color';
import { useConfirmAttendance, useDeleteSession, useSessions } from '../api/hooks';
import { isAttendanceConfirmed, type PlannerSession } from '../api/sessions';
import { promptAdminPassword } from '../../../lib/admin-password';
import { AdminCalendarGrid } from './admin-calendar-grid';
import { DateField } from '../../../components/date-field';
import { SessionDetailSheet } from '../components/session-detail-sheet';

const DAY = 24 * 3600 * 1000;
type ViewMode = 'day' | 'week' | 'month';
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'day', label: 'Günlük' },
  { key: 'week', label: 'Haftalık' },
];

/**
 * Admin planner — web mobil paritesi: kart-liste (zaman-satırı + personel slot
 * kartları), Günlük/Haftalık/Aylık görünüm, gün/aralık navigasyonu, Bugün.
 */
export function AdminPlannerScreen() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('day');
  const [anchor, setAnchor] = useState(() => Date.now());
  const { contentMaxWidth, gutter } = useResponsive();

  const range = useMemo(() => computeRange(view, anchor), [view, anchor]);
  const { data, isLoading } = useSessions({
    startDate: toDateStr(range.start),
    endDate: toDateStr(range.end),
  });
  const del = useDeleteSession();
  const confirm = useConfirmAttendance();
  const { data: staff } = useStaff();
  const { data: rooms } = useRooms();
  // Seçili slot anahtarı (saat + personel) — grup canlı veriden türetilir ki
  // yoklama/silme sonrası sheet otomatik güncellensin.
  const [selectedKey, setSelectedKey] = useState<{ startTs: number; staffId: number | null } | null>(null);

  // filtreler
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filterStaffId, setFilterStaffId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const filterActive = !!search.trim() || filterStaffId != null;

  const sessions = useMemo(() => {
    let list = data ?? [];
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (q) list = list.filter((s) => s.memberName.toLocaleLowerCase('tr-TR').includes(q));
    if (filterStaffId != null) list = list.filter((s) => s.staffId === filterStaffId);
    return list;
  }, [data, search, filterStaffId]);

  // tarihe göre grupla (sadece seansı olan günler)
  const days = useMemo(() => {
    const byDate = new Map<string, PlannerSession[]>();
    for (const s of sessions) {
      const d = toDateStr(s.startTs);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(s);
    }
    return enumerateDays(range.start, range.end)
      .map((ts) => ({ ts, dateStr: toDateStr(ts) }))
      .map((d) => ({ ...d, sessions: byDate.get(d.dateStr) ?? [] }))
      .filter((d) => d.sessions.length > 0);
  }, [sessions, range]);

  // Seçili slottaki canlı seanslar (grup).
  const selectedGroup = useMemo(() => {
    if (!selectedKey) return null;
    const g = (data ?? []).filter(
      (s) => s.startTs === selectedKey.startTs && s.staffId === selectedKey.staffId,
    );
    return g.length ? g : null;
  }, [data, selectedKey]);

  function openForm(s: PlannerSession) {
    setSelectedKey(null);
    router.push({ pathname: '/(admin)/planner/session-form', params: { id: String(s.id), date: toDateStr(s.startTs) } });
  }
  async function onDeleteGroup(grp: PlannerSession[]) {
    const isGroup = grp.length > 1;
    const msg = isGroup
      ? `${grp.length} seans (${formatSessionRange(grp[0].startTs, grp[0].endTs)}) silinsin mi?`
      : `${grp[0].memberName || 'Seans'} (${formatSessionRange(grp[0].startTs, grp[0].endTs)}) silinsin mi?`;
    Alert.alert(isGroup ? 'Grubu sil' : 'Seansı sil', msg, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            // Onaylanmış seans varsa admin şifresi (web paritesi).
            let adminPassword: string | undefined;
            if (grp.some((s) => isAttendanceConfirmed(s))) {
              const pwd = await promptAdminPassword('Girişi onaylanmış seans(lar)ı silmek için admin şifrenizi girin.');
              if (pwd == null) return;
              adminPassword = pwd;
            }
            for (const s of grp) await del.mutateAsync({ id: s.id, adminPassword });
            setSelectedKey(null);
          } catch (e) {
            Alert.alert('Hata', (e as Error).message);
          }
        },
      },
    ]);
  }
  function onAttendance(s: PlannerSession, action: 'present' | 'no_show') {
    confirm.mutate(
      { sessionId: s.id, action },
      { onError: (e) => Alert.alert('Hata', (e as Error).message) },
    );
  }

  const step = view === 'day' ? DAY : view === 'week' ? 7 * DAY : 30 * DAY;

  const rangeLabel =
    view === 'day' ? formatDayShort(anchor) : view === 'month' ? monthLabel(anchor) : weekRangeLabel(range.start, range.end);
  const isToday = view === 'day' && toDateStr(anchor) === toDateStr(Date.now());

  function goToday() {
    setAnchor(Date.now());
    setView('day');
  }

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Takvim"
        right={
          <View style={styles.navInline}>
            <Pressable onPress={() => setAnchor((t) => t - step)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <DateField
              value={toDateStr(anchor)}
              onChange={(v) => {
                const [y, m, d] = v.split('-').map(Number);
                setAnchor(new Date(y, m - 1, d).getTime());
              }}
              trigger={<Text style={styles.dayLabel}>{rangeLabel}</Text>}
            />
            <Pressable onPress={() => setAnchor((t) => t + step)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      {/* görünüm seçici + Bugün */}
      <View style={[styles.toolbar, wide]}>
        <View style={styles.viewGroup}>
          {VIEWS.map((v) => (
            <Pressable key={v.key} onPress={() => setView(v.key)} style={[styles.viewBtn, view === v.key && styles.viewBtnActive]}>
              <Text style={[styles.viewText, view === v.key && styles.viewTextActive]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
        {!isToday ? (
          <Pressable onPress={goToday} style={styles.todayBtn}>
            <Text style={styles.todayText}>Bugün</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setFiltersOpen((v) => !v)} style={[styles.filterBtn, filterActive && styles.filterBtnActive]}>
          <Ionicons name="filter" size={18} color={filterActive ? colors.text : colors.muted} />
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={[styles.filterPanel, wide]}>
          <TextInput
            style={styles.search}
            placeholder="Üye adı, soyadı ara"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.staffChips}>
            {(staff ?? []).map((s, idx) => {
              const c = staffColor(idx, s.id);
              const sel = filterStaffId === s.id;
              const parts = s.fullName.trim().split(/\s+/);
              const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
              return (
                <Pressable
                  key={s.id}
                  style={[styles.staffChip, { borderColor: c.border, backgroundColor: sel ? c.bg : 'rgba(255,255,255,0.03)' }]}
                  onPress={() => setFilterStaffId(sel ? null : s.id)}
                >
                  <Text style={[styles.staffChipInitial, { color: sel ? colors.text : c.border }]}>{initials.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : days.length === 0 ? (
        <View style={[styles.empty, wide]}>
          <Card><Muted>Bu aralıkta seans yok.</Muted></Card>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {days.map((d) => (
            <View key={d.dateStr} style={styles.dayBlock}>
              {view !== 'day' ? (
                <Text style={[styles.dayHeader, { paddingHorizontal: gutter }]}>{dayHeaderLabel(d.ts)}</Text>
              ) : null}
              <AdminCalendarGrid
                dayTs={d.ts}
                sessions={d.sessions}
                fullRail={view === 'day'}
                onPressGroup={(g) => router.push({
                  pathname: '/(admin)/planner/session-form',
                  params: { id: String(g[0].id), date: toDateStr(g[0].startTs) },
                })}
                onLongPressGroup={(g) => setSelectedKey({ startTs: g[0].startTs, staffId: g[0].staffId })}
              />
            </View>
          ))}
        </ScrollView>
      )}
      <Fab onPress={() => router.push('/(admin)/planner/session-form')} />

      <SessionDetailSheet
        group={selectedGroup}
        onClose={() => setSelectedKey(null)}
        onEdit={openForm}
        onDeleteGroup={onDeleteGroup}
        onAttendance={onAttendance}
        busy={confirm.isPending || del.isPending}
      />
    </SafeAreaView>
  );
}

function computeRange(view: ViewMode, anchor: number): { start: number; end: number } {
  if (view === 'day') return { start: anchor, end: anchor };
  if (view === 'week') {
    const start = startOfWeekTs(anchor);
    return { start, end: start + 6 * DAY };
  }
  return { start: startOfMonthTs(anchor), end: endOfMonthTs(anchor) };
}

function weekRangeLabel(start: number, end: number): string {
  return `${formatDayLabel(start)} – ${formatDayLabel(end)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 2 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  navInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCenter: { alignItems: 'center', flex: 1 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.text, width: 132, textAlign: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 10 },
  viewGroup: { flex: 1, flexDirection: 'row', gap: 6 },
  viewBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  viewBtnActive: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  viewText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  viewTextActive: { color: colors.text },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(124,92,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.5)',
  },
  todayText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  filterPanel: { paddingBottom: 10, gap: 8 },
  staffChips: { flexDirection: 'row', gap: 6, paddingVertical: 2, justifyContent: 'space-between' },
  staffChip: {
    flex: 1, height: 42,
    borderRadius: 10, borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  staffChipAllOn: { borderColor: 'rgba(124,92,255,0.5)', backgroundColor: 'rgba(124,92,255,0.18)' },
  staffChipInitial: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  staffChipTextOn: { color: colors.text },
  search: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 46,
    color: colors.text,
    fontSize: 16,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterCol: { flex: 1 },
  clearBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  clearText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  empty: { paddingTop: 12 },
  scroll: { paddingBottom: 96, flexGrow: 1 },
  dayBlock: { marginBottom: 6 },
  dayHeader: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 2 },
});
