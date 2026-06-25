import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useNotifications } from '../api/hooks';
import type { StaffNotification } from '../api/notifications';

const PER_PAGE = 20;
const TZ = 3 * 3600 * 1000; // UTC+3

type PeriodKey = 'day' | 'week' | 'month' | 'year';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Gün' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' },
  { key: 'year', label: 'Yıl' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'cancel', label: 'İptaller' },
  { key: 'checkin', label: 'Check-in' },
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number]['key'];

// ── Tarih yardımcıları (UTC+3 bazlı) ─────────────────────────────────────

function startOfDayIst(ts: number): number {
  const d = new Date(ts + TZ);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ;
}
function startOfWeekIst(ts: number): number {
  const sod = startOfDayIst(ts);
  const dow = new Date(sod + TZ).getUTCDay(); // 0=Sun
  const diffToMon = (dow + 6) % 7;
  return sod - diffToMon * 86400000;
}
function startOfMonthIst(ts: number): number {
  const d = new Date(ts + TZ);
  d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ;
}
function startOfYearIst(ts: number): number {
  const d = new Date(ts + TZ);
  d.setUTCMonth(0, 1); d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ;
}

function anchorRange(period: PeriodKey, anchor: number): { since: number; until: number } {
  switch (period) {
    case 'day': {
      const since = startOfDayIst(anchor);
      return { since, until: since + 86400000 - 1 };
    }
    case 'week': {
      const since = startOfWeekIst(anchor);
      return { since, until: since + 7 * 86400000 - 1 };
    }
    case 'month': {
      const since = startOfMonthIst(anchor);
      const d = new Date(since + TZ);
      d.setUTCMonth(d.getUTCMonth() + 1);
      return { since, until: d.getTime() - TZ - 1 };
    }
    case 'year': {
      const since = startOfYearIst(anchor);
      const d = new Date(since + TZ);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return { since, until: d.getTime() - TZ - 1 };
    }
  }
}

function stepMs(period: PeriodKey): number {
  switch (period) {
    case 'day':   return 86400000;
    case 'week':  return 7 * 86400000;
    case 'month': return 0; // özel hesap
    case 'year':  return 0;
  }
}

function stepAnchor(period: PeriodKey, anchor: number, dir: 1 | -1): number {
  if (period === 'day')  return anchor + dir * 86400000;
  if (period === 'week') return anchor + dir * 7 * 86400000;
  if (period === 'month') {
    const d = new Date(startOfMonthIst(anchor) + TZ);
    d.setUTCMonth(d.getUTCMonth() + dir);
    return d.getTime() - TZ;
  }
  // year
  const d = new Date(startOfYearIst(anchor) + TZ);
  d.setUTCFullYear(d.getUTCFullYear() + dir);
  return d.getTime() - TZ;
}

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function periodLabel(period: PeriodKey, anchor: number): string {
  const d = new Date(anchor + TZ);
  switch (period) {
    case 'day': {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      return `${dd}.${mm}.${d.getUTCFullYear()}`;
    }
    case 'week': {
      const mon = new Date(startOfWeekIst(anchor) + TZ);
      const sun = new Date(startOfWeekIst(anchor) + 6 * 86400000 + TZ);
      return `${String(mon.getUTCDate()).padStart(2,'0')}.${String(mon.getUTCMonth()+1).padStart(2,'0')} – ${String(sun.getUTCDate()).padStart(2,'0')}.${String(sun.getUTCMonth()+1).padStart(2,'0')}.${sun.getUTCFullYear()}`;
    }
    case 'month':
      return `${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case 'year':
      return `${d.getUTCFullYear()}`;
  }
}

function fmtAt(at: number): string {
  if (!at) return '';
  const d = new Date(at + TZ);
  return `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

// ── Bileşen ───────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const { contentMaxWidth, gutter } = useResponsive();
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [anchor, setAnchor] = useState(() => Date.now());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);

  const { since, until } = useMemo(() => anchorRange(period, anchor), [period, anchor]);
  const { data, isLoading, isFetching } = useNotifications(since, until, page, PER_PAGE);

  const items = useMemo(
    () => (data?.items ?? []).filter((n) => typeFilter === 'all' || n.type === typeFilter),
    [data, typeFilter],
  );
  const totalPages = data?.totalPages ?? 1;

  const wide = { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const };

  function changePeriod(p: PeriodKey) {
    setPeriod(p);
    setAnchor(Date.now());
    setPage(1);
  }
  function changeType(t: TypeFilter) { setTypeFilter(t); setPage(1); }
  function nav(dir: 1 | -1) { setAnchor((a) => stepAnchor(period, a, dir)); setPage(1); }
  const isToday = anchorRange(period, Date.now()).since <= Date.now() && anchorRange(period, Date.now()).since === since;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Bildirimler" />

      {/* Periyod tipi seçici */}
      <View style={[styles.row, wide]}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} style={[styles.periodBtn, period === p.key && styles.periodBtnOn]} onPress={() => changePeriod(p.key)}>
            <Text style={[styles.periodText, period === p.key && styles.periodTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Periyod navigasyonu */}
      <View style={[styles.navRow, wide]}>
        <Pressable onPress={() => nav(-1)} style={styles.navBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => { setAnchor(Date.now()); setPage(1); }} hitSlop={6} style={styles.navLabel}>
          <Text style={styles.navLabelText}>{periodLabel(period, anchor)}</Text>
        </Pressable>
        <Pressable onPress={() => nav(1)} style={styles.navBtn} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
        {isFetching ? <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 6 }} /> : null}
      </View>

      {/* Tür filtresi */}
      <View style={[styles.row, wide, { marginBottom: 2 }]}>
        {TYPE_FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.chip, typeFilter === f.key && styles.chipOn]} onPress={() => changeType(f.key)}>
            <Text style={[styles.chipText, typeFilter === f.key && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => `${n.type}-${n.id}`}
          contentContainerStyle={[styles.list, wide]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Card><Muted>Bu dönemde bildirim yok.</Muted></Card>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]} disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                  <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.muted : colors.text} />
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextOff]}>Önceki</Text>
                </Pressable>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <Pressable style={[styles.pageBtn, page >= totalPages && styles.pageBtnOff]} disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}>
                  <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextOff]}>Sonraki</Text>
                  <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? colors.muted : colors.text} />
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }: { item: StaffNotification }) => {
            const isCancel = item.type === 'cancel';
            return (
              <View style={styles.item}>
                <View style={styles.itemHead}>
                  <Ionicons name={isCancel ? 'close-circle-outline' : 'checkmark-circle-outline'} size={18} color={isCancel ? colors.danger : colors.ok} />
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.time}>{fmtAt(item.at)}</Text>
                </View>
                {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: 6, paddingVertical: 6 },

  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  periodBtnOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  periodText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  periodTextOn: { color: colors.text },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  navBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { flex: 1, alignItems: 'center' },
  navLabelText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.text },

  list: { paddingVertical: 8, gap: 8, flexGrow: 1 },
  item: {
    padding: 12, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', gap: 4,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  time: { color: colors.muted, fontSize: 11, flexShrink: 0 },
  body: { color: 'rgba(232,236,255,0.75)', fontSize: 13, paddingLeft: 26 },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  pageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pageBtnOff: { opacity: 0.4 },
  pageBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  pageBtnTextOff: { color: colors.muted },
  pageInfo: { color: colors.muted, fontSize: 13 },
});
