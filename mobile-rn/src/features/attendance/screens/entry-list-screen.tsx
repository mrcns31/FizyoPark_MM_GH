import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '../../../components/date-field';
import { Badge, Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { formatDayShort, formatTime } from '../../../lib/datetime';

const DAY_MS = 24 * 3600 * 1000;

function tsToDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateStrToTs(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useConfirmAttendance, useEntryList, useWalkInList } from '../api/hooks';

const PRESENT_KINDS = ['qr', 'phone', 'card', 'admin_present', 'staff_present'];
const PHYSICAL_ENTRY_KINDS = ['qr', 'phone', 'card'];

const STATUS_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'present', label: 'Geldi' },
  { key: 'no_show', label: 'Gelmedi' },
  { key: 'scheduled', label: 'Planlandı' },
  { key: 'pending', label: 'Onaylanmadı' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['key'];

const WALKIN_FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'qr', label: 'QR' },
  { key: 'phone', label: 'Telefon' },
  { key: 'card', label: 'Kart' },
] as const;
type WalkInFilter = (typeof WALKIN_FILTERS)[number]['key'];

function statusTone(kind: string): 'green' | 'red' | 'orange' | 'neutral' {
  if (PRESENT_KINDS.includes(kind)) return 'green';
  if (kind === 'no_show') return 'red';
  if (kind === 'pending') return 'orange';
  return 'neutral';
}
function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Giriş Listesi — seans giriş logu + randevusuz girişler (web `renderEntryListFromCache`). */
export function EntryListScreen() {
  const { contentMaxWidth, gutter } = useResponsive();
  const [date, setDate] = useState(todayStr());
  const [tab, setTab] = useState<'entry' | 'walkin'>('entry');
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [walkF, setWalkF] = useState<WalkInFilter>('all');

  const entryQ = useEntryList(date);
  const walkQ = useWalkInList(date);
  const confirm = useConfirmAttendance(date);

  const entries = useMemo(() => {
    const list = entryQ.data ?? [];
    if (statusF === 'all') return list;
    if (statusF === 'present') return list.filter((s) => PRESENT_KINDS.includes(s.statusKind));
    return list.filter((s) => s.statusKind === statusF);
  }, [entryQ.data, statusF]);

  const walkIns = useMemo(() => {
    const list = walkQ.data ?? [];
    if (walkF === 'all') return list;
    return list.filter((e) => e.source === walkF);
  }, [walkQ.data, walkF]);

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Giriş Listesi"
        right={
          <View style={styles.dateNav}>
            <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(tsToDateStr(dateStrToTs(date) - DAY_MS))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <DateField
              value={date}
              onChange={setDate}
              trigger={<Text style={styles.dateLabel}>{formatDayShort(dateStrToTs(date))}</Text>}
            />
            <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setDate(tsToDateStr(dateStrToTs(date) + DAY_MS))}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        }
      />
      <View style={[styles.top, wide]}>
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'entry' && styles.tabOn]} onPress={() => setTab('entry')}>
            <Text style={[styles.tabText, tab === 'entry' && styles.tabTextOn]}>Giriş Listesi</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'walkin' && styles.tabOn]} onPress={() => setTab('walkin')}>
            <Text style={[styles.tabText, tab === 'walkin' && styles.tabTextOn]}>Randevusuz</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(tab === 'entry' ? STATUS_FILTERS : WALKIN_FILTERS).map((f) => {
            const sel = tab === 'entry' ? statusF === f.key : walkF === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, sel && styles.chipOn]}
                onPress={() => (tab === 'entry' ? setStatusF(f.key as StatusFilter) : setWalkF(f.key as WalkInFilter))}
              >
                <Text style={[styles.chipText, sel && styles.chipTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={[styles.list, wide]} showsVerticalScrollIndicator={false}>
        {tab === 'entry' ? (
          entries.length === 0 ? (
            <Card>
              <Muted>Bu tarihte üye seansı yok.</Muted>
            </Card>
          ) : (
            entries.map((s) => (
              <View key={s.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.time}>{formatTime(s.startTs)}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.member} numberOfLines={1}>
                      {s.memberName}
                    </Text>
                    <Text style={styles.staff} numberOfLines={1}>
                      {s.staffName}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Badge label={s.attendanceLabel} tone={statusTone(s.statusKind)} />
                  {s.canAdminApprove ? (
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.actBtn, styles.actPresent]}
                        hitSlop={6}
                        onPress={() =>
                          confirm.mutate(
                            { id: s.id, action: 'present' },
                            { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                          )
                        }
                      >
                        <Ionicons name="checkmark" size={16} color={colors.ok} />
                      </Pressable>
                      {!PHYSICAL_ENTRY_KINDS.includes(s.statusKind) ? (
                        <Pressable
                          style={[styles.actBtn, styles.actNoShow]}
                          hitSlop={6}
                          onPress={() =>
                            confirm.mutate(
                              { id: s.id, action: 'no_show' },
                              { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                            )
                          }
                        >
                          <Ionicons name="close" size={16} color={colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )
        ) : walkIns.length === 0 ? (
          <Card>
            <Muted>Bu tarihte randevusuz giriş yok.</Muted>
          </Card>
        ) : (
          walkIns.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.time}>{formatTime(e.accessedAt)}</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.member} numberOfLines={1}>
                    {e.memberName || 'Bilinmeyen'} {e.memberNo ? `(${e.memberNo})` : ''}
                  </Text>
                </View>
              </View>
              <Badge label={e.label || e.source?.toUpperCase() || 'Giriş'} tone="accent" />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { gap: 10, paddingTop: 4, paddingBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.text },
  chips: { gap: 6, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.text },
  list: { paddingBottom: 24, gap: 8, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  time: { color: colors.text, fontSize: 15, fontWeight: '800', minWidth: 46 },
  rowInfo: { flex: 1, gap: 2 },
  member: { color: colors.text, fontSize: 14, fontWeight: '600' },
  staff: { color: colors.muted, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  actBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actPresent: { borderColor: 'rgba(43,213,118,0.5)', backgroundColor: 'rgba(43,213,118,0.12)' },
  actNoShow: { borderColor: 'rgba(255,77,109,0.5)', backgroundColor: 'rgba(255,77,109,0.12)' },
});
