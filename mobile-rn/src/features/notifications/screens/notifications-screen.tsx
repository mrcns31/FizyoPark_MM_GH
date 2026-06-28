import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useLatestNotification, useNotifications } from '../api/hooks';
import { useAuth } from '../../auth';
import { StaffDateBar, useStaffDate } from '../../staff/context/staff-date-context';
import type { StaffNotification } from '../api/notifications';

const PER_PAGE = 20;
const TZ = 3 * 3600 * 1000; // UTC+3

// ── Tarih yardımcıları ────────────────────────────────────────────────────

function startOfDayIst(ts: number): number {
  const d = new Date(ts + TZ);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ;
}

function fmtDate(ts: number): string {
  const d = new Date(ts + TZ);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const dow = days[d.getUTCDay()];
  return `${dd}.${mm}.${yyyy} ${dow}`;
}

function fmtAt(at: number): string {
  if (!at) return '';
  const d = new Date(at + TZ);
  return `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

// ── Admin görünümü (gün/hafta/ay/yıl navigasyonu) ─────────────────────────

type PeriodKey = 'day' | 'week' | 'month' | 'year';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Gün' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' },
  { key: 'year', label: 'Yıl' },
];
const TYPE_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'admin_cancel', label: 'İptaller' },
  { key: 'checkin', label: 'Check-in' },
  { key: 'shift_reminder', label: 'Hatırlatmalar' },
] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number]['key'];

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function anchorRange(period: PeriodKey, anchor: number) {
  const sod = startOfDayIst(anchor);
  switch (period) {
    case 'day':   return { since: sod, until: sod + 86400000 - 1 };
    case 'week': {
      const dow = new Date(sod + TZ).getUTCDay();
      const mon = sod - ((dow + 6) % 7) * 86400000;
      return { since: mon, until: mon + 7 * 86400000 - 1 };
    }
    case 'month': {
      const d = new Date(sod + TZ); d.setUTCDate(1);
      const since = d.getTime() - TZ;
      const e = new Date(since + TZ); e.setUTCMonth(e.getUTCMonth() + 1);
      return { since, until: e.getTime() - TZ - 1 };
    }
    case 'year': {
      const d = new Date(sod + TZ); d.setUTCMonth(0, 1);
      const since = d.getTime() - TZ;
      const e = new Date(since + TZ); e.setUTCFullYear(e.getUTCFullYear() + 1);
      return { since, until: e.getTime() - TZ - 1 };
    }
  }
}

function stepAnchor(period: PeriodKey, anchor: number, dir: 1 | -1): number {
  if (period === 'day')  return anchor + dir * 86400000;
  if (period === 'week') return anchor + dir * 7 * 86400000;
  if (period === 'month') {
    const d = new Date(startOfDayIst(anchor) + TZ);
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + dir);
    return d.getTime() - TZ;
  }
  const d = new Date(startOfDayIst(anchor) + TZ);
  d.setUTCMonth(0, 1); d.setUTCFullYear(d.getUTCFullYear() + dir);
  return d.getTime() - TZ;
}

function periodLabel(period: PeriodKey, anchor: number): string {
  const d = new Date(anchor + TZ);
  switch (period) {
    case 'day':   return fmtDate(anchor);
    case 'week': {
      const dow = d.getUTCDay();
      const mon = new Date(startOfDayIst(anchor) - ((dow + 6) % 7) * 86400000 + TZ);
      const sun = new Date(startOfDayIst(anchor) + (6 - (dow + 6) % 7) * 86400000 + TZ);
      return `${String(mon.getUTCDate()).padStart(2,'0')}.${String(mon.getUTCMonth()+1).padStart(2,'0')} – ${String(sun.getUTCDate()).padStart(2,'0')}.${String(sun.getUTCMonth()+1).padStart(2,'0')}.${sun.getUTCFullYear()}`;
    }
    case 'month': return `${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    case 'year':  return `${d.getUTCFullYear()}`;
  }
}

function AdminNotifications({ wide }: { wide: object }) {
  const [period, setPeriod] = useState<PeriodKey>('day');
  const [anchor, setAnchor] = useState(() => Date.now());
  const [anchorReady, setAnchorReady] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);

  const { data: latestData } = useLatestNotification();
  useEffect(() => {
    if (anchorReady) return;
    if (!latestData) return;
    const latest = latestData.items[0];
    if (latest?.at) setAnchor(latest.at);
    setAnchorReady(true);
  }, [latestData, anchorReady]);

  const { since, until } = useMemo(() => anchorRange(period, anchor), [period, anchor]);
  const { data, isLoading, isFetching } = useNotifications(since, until, page, PER_PAGE);

  const items = useMemo(
    () => (data?.items ?? []).filter((n) => typeFilter === 'all' || n.type === typeFilter),
    [data, typeFilter],
  );

  function changePeriod(p: PeriodKey) { setPeriod(p); setAnchor(Date.now()); setPage(1); }
  function changeType(t: TypeFilter) { setTypeFilter(t); setPage(1); }
  function nav(dir: 1 | -1) { setAnchor((a) => stepAnchor(period, a, dir)); setPage(1); }

  return (
    <>
      <View style={[styles.row, wide as any]}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} style={[styles.periodBtn, period === p.key && styles.periodBtnOn]} onPress={() => changePeriod(p.key)}>
            <Text style={[styles.periodText, period === p.key && styles.periodTextOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.navRow, wide as any]}>
        <Pressable onPress={() => nav(-1)} style={styles.navBtn} hitSlop={10}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Pressable onPress={() => { setAnchor(Date.now()); setPage(1); }} style={styles.navLabel}>
          <Text style={styles.navLabelText}>{periodLabel(period, anchor)}</Text>
        </Pressable>
        <Pressable onPress={() => nav(1)} style={styles.navBtn} hitSlop={10}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Pressable>
        {isFetching ? <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 6 }} /> : null}
      </View>
      <View style={[styles.row, wide as any, { marginBottom: 2 }]}>
        {TYPE_FILTERS.map((f) => (
          <Pressable key={f.key} style={[styles.chip, typeFilter === f.key && styles.chipOn]} onPress={() => changeType(f.key)}>
            <Text style={[styles.chipText, typeFilter === f.key && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      <NotificationList items={items} isLoading={isLoading} totalPages={data?.totalPages ?? 1} page={page} setPage={setPage} wide={wide} />
    </>
  );
}

// ── Personel görünümü — context'teki ortak tarihi kullanır ───────────────

function StaffNotifications({ wide }: { wide: object }) {
  const { dayTs } = useStaffDate();
  const [page, setPage] = useState(1);

  const { since, until } = useMemo(() => {
    const sod = startOfDayIst(dayTs);
    return { since: sod, until: sod + 86400000 - 1 };
  }, [dayTs]);

  const { data, isLoading } = useNotifications(since, until, page, PER_PAGE);
  const items = data?.items ?? [];

  return (
    <>
      <StaffDateBar wide={wide} />
      <NotificationList items={items} isLoading={isLoading} totalPages={data?.totalPages ?? 1} page={page} setPage={setPage} wide={wide} />
    </>
  );
}

// ── Ortak liste bileşeni ─────────────────────────────────────────────────

function NotificationList({ items, isLoading, totalPages, page, setPage, wide }: {
  items: StaffNotification[];
  isLoading: boolean;
  totalPages: number;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  wide: object;
}) {
  if (isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => `${n.type}-${n.id}`}
      contentContainerStyle={[styles.list, wide as any]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Card><Muted>Bu tarihte bildirim yok.</Muted></Card>}
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
        const isAdminCancel = item.type === 'admin_cancel';
        const isReminder    = item.type === 'shift_reminder';
        const iconName      = isAdminCancel ? 'close-circle-outline' : isReminder ? 'alert-circle-outline' : 'checkmark-circle-outline';
        const iconColor     = isAdminCancel ? colors.danger : isReminder ? colors.fpOrange : colors.ok;

        let title = item.title ?? '';
        let body  = item.body  ?? '';
        if (isAdminCancel) {
          title = 'Admin Randevu İptali';
          const datePart = item.startTs
            ? new Date(item.startTs).toLocaleString('tr-TR', {
                timeZone: 'Europe/Istanbul',
                day: '2-digit', month: '2-digit', year: 'numeric',
                weekday: 'long', hour: '2-digit', minute: '2-digit',
              })
            : '';
          const parts: string[] = [];
          if (item.memberName) parts.push(item.memberName);
          if (datePart) parts.push(datePart);
          body = parts.join(', ') + (item.staffName ? ' - ' + item.staffName + ' ile olan randevusu iptal edildi' : ' iptal edildi');
        }

        return (
          <View style={[styles.item, isReminder && styles.itemReminder, isAdminCancel && styles.itemCancel]}>
            <View style={styles.itemHead}>
              <Ionicons name={iconName} size={18} color={iconColor} />
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.time}>{fmtAt(item.at)}</Text>
            </View>
            {body ? <Text style={styles.body} numberOfLines={2}>{body}</Text> : null}
          </View>
        );
      }}
    />
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const { contentMaxWidth, gutter } = useResponsive();
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  const wide = { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Bildirimler" />
      {isStaff
        ? <StaffNotifications wide={wide} />
        : <AdminNotifications wide={wide} />
      }
    </SafeAreaView>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: 6, paddingVertical: 6 },

  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  periodBtnOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  periodText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  periodTextOn: { color: colors.text },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  navBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.3 },
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
    padding: 12, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', gap: 4,
  },
  itemReminder: {
    borderColor: 'rgba(255,149,0,0.4)',
    backgroundColor: 'rgba(255,149,0,0.06)',
  },
  itemCancel: {
    borderColor: 'rgba(255,77,109,0.4)',
    backgroundColor: 'rgba(255,77,109,0.05)',
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  time: { color: colors.muted, fontSize: 11, flexShrink: 0 },
  body: { color: 'rgba(232,236,255,0.75)', fontSize: 13, paddingLeft: 26 },

  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  pageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pageBtnOff: { opacity: 0.4 },
  pageBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  pageBtnTextOff: { color: colors.muted },
  pageInfo: { color: colors.muted, fontSize: 13 },
});
