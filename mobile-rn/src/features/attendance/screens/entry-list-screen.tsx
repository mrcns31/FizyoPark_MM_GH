import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateField } from '../../../components/date-field';
import { Badge, Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { formatDayShort, formatTime } from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useConfirmAttendance, useEntryList, useWalkInList } from '../api/hooks';

const DAY_MS = 24 * 3600 * 1000;

type ViewMode = 'day' | 'week' | 'month';

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

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tsToDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStrToTs(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function getDateRange(anchor: string, mode: ViewMode): { start: string; end: string; label: string } {
  if (mode === 'day') {
    return { start: anchor, end: anchor, label: formatDayShort(dateStrToTs(anchor)) };
  }
  if (mode === 'week') {
    const d = new Date(anchor + 'T12:00:00');
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = dateToStr(monday);
    const end = dateToStr(sunday);
    return {
      start, end,
      label: `${formatDayShort(monday.getTime())} – ${formatDayShort(sunday.getTime())}`,
    };
  }
  // month
  const [y, m] = anchor.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, label: `${MONTH_NAMES[m - 1]} ${y}` };
}

function navigateAnchor(anchor: string, mode: ViewMode, dir: -1 | 1): string {
  const d = new Date(anchor + 'T12:00:00');
  if (mode === 'day') d.setDate(d.getDate() + dir);
  else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setMonth(d.getMonth() + dir);
  return dateToStr(d);
}

function fmtDateShort(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`;
}

/** Giriş Listesi */
export function EntryListScreen() {
  const { contentMaxWidth, gutter } = useResponsive();
  const [anchor, setAnchor] = useState(todayStr());
  const [mode, setMode] = useState<ViewMode>('day');
  const [tab, setTab] = useState<'entry' | 'walkin'>('entry');
  const [statusF, setStatusF] = useState<StatusFilter>('all');
  const [walkF, setWalkF] = useState<WalkInFilter>('all');
  const [search, setSearch] = useState('');

  const { start, end, label } = getDateRange(anchor, mode);

  const entryQ = useEntryList(start, end);
  const walkQ = useWalkInList(start, end);
  const confirm = useConfirmAttendance(start, end);

  const showDateCol = mode !== 'day';

  const entries = useMemo(() => {
    let list = entryQ.data ?? [];
    if (statusF === 'present') list = list.filter((s) => PRESENT_KINDS.includes(s.statusKind));
    else if (statusF !== 'all') list = list.filter((s) => s.statusKind === statusF);
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr');
      list = list.filter((s) =>
        s.memberName.toLocaleLowerCase('tr').includes(q) ||
        s.staffName.toLocaleLowerCase('tr').includes(q),
      );
    }
    return list;
  }, [entryQ.data, statusF, search]);

  const walkIns = useMemo(() => {
    let list = walkQ.data ?? [];
    if (walkF !== 'all') list = list.filter((e) => e.source === walkF);
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('tr');
      list = list.filter((e) => (e.memberName || '').toLocaleLowerCase('tr').includes(q));
    }
    return list;
  }, [walkQ.data, walkF, search]);

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Giriş Listesi"
        right={
          <View style={styles.dateNav}>
            <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setAnchor(navigateAnchor(anchor, mode, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            {mode === 'day' ? (
              <DateField
                value={anchor}
                onChange={setAnchor}
                trigger={<Text style={styles.dateLabel}>{label}</Text>}
              />
            ) : (
              <Text style={styles.dateLabel}>{label}</Text>
            )}
            <Pressable style={styles.navBtn} hitSlop={10} onPress={() => setAnchor(navigateAnchor(anchor, mode, 1))}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      <View style={[styles.top, wide]}>
        {/* Görünüm modu: Gün / Hafta / Ay */}
        <View style={styles.viewModeRow}>
          {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextOn]}>
                {m === 'day' ? 'Gün' : m === 'week' ? 'Hafta' : 'Ay'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sekmeler */}
        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'entry' && styles.tabOn]} onPress={() => setTab('entry')}>
            <Text style={[styles.tabText, tab === 'entry' && styles.tabTextOn]}>Randevulu</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'walkin' && styles.tabOn]} onPress={() => setTab('walkin')}>
            <Text style={[styles.tabText, tab === 'walkin' && styles.tabTextOn]}>Randevusuz</Text>
          </Pressable>
        </View>

        {/* Filtreler */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(tab === 'entry' ? STATUS_FILTERS : WALKIN_FILTERS).map((f) => {
            const sel = tab === 'entry' ? statusF === f.key : walkF === f.key;
            const isPresent = f.key === 'present';
            const isNoShow = f.key === 'no_show';
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.chip,
                  sel && styles.chipOn,
                  isPresent && styles.chipPresent,
                  isNoShow && styles.chipNoShow,
                  isPresent && sel && styles.chipPresentOn,
                  isNoShow && sel && styles.chipNoShowOn,
                ]}
                onPress={() => (tab === 'entry' ? setStatusF(f.key as StatusFilter) : setWalkF(f.key as WalkInFilter))}
              >
                {isPresent ? (
                  <Ionicons name="checkmark" size={16} color={sel ? colors.ok : 'rgba(43,213,118,0.6)'} />
                ) : isNoShow ? (
                  <Ionicons name="close" size={16} color={sel ? colors.danger : 'rgba(255,77,109,0.6)'} />
                ) : (
                  <Text style={[styles.chipText, sel && styles.chipTextOn]}>{f.label}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Arama */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={tab === 'entry' ? 'Üye veya personel ara…' : 'Üye ara…'}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable hitSlop={8} onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.list, wide]} showsVerticalScrollIndicator={false}>
        {tab === 'entry' ? (
          entries.length === 0 ? (
            <Card><Muted>{entryQ.isLoading ? 'Yükleniyor…' : 'Kayıt yok.'}</Muted></Card>
          ) : (
            entries.map((s) => {
              const isEditable = !!s.canAdminEdit;
              const row = (
                <View key={s.id} style={[styles.row, isEditable && styles.rowEditable]}>
                  <View style={styles.rowLeft}>
                    <View style={styles.timeCol}>
                      {showDateCol ? (
                        <Text style={styles.dateInRow}>{fmtDateShort(s.startTs)}</Text>
                      ) : null}
                      <Text style={styles.time}>{formatTime(s.startTs)}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.member} numberOfLines={1}>{s.memberName}</Text>
                      <Text style={styles.staff} numberOfLines={1}>{s.staffName}</Text>
                      {PHYSICAL_ENTRY_KINDS.includes(s.statusKind) && s.checkedInAt ? (
                        <Text style={styles.checkInTime} numberOfLines={1}>
                          {s.statusKind === 'qr' ? 'QR' : s.statusKind === 'card' ? 'Kart' : 'Telefon'} girişi: {formatTime(new Date(s.checkedInAt).getTime())}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <Badge label={s.attendanceLabel} tone={statusTone(s.statusKind)} />
                    {s.canAdminApprove ? (
                      <View style={styles.actions}>
                        <Pressable
                          style={[styles.actBtn, styles.actPresent]}
                          hitSlop={6}
                          onPress={() => confirm.mutate(
                            { id: s.id, action: 'present' },
                            { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                          )}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.ok} />
                        </Pressable>
                        {!PHYSICAL_ENTRY_KINDS.includes(s.statusKind) ? (
                          <Pressable
                            style={[styles.actBtn, styles.actNoShow]}
                            hitSlop={6}
                            onPress={() => confirm.mutate(
                              { id: s.id, action: 'no_show' },
                              { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                            )}
                          >
                            <Ionicons name="close" size={16} color={colors.danger} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                    {isEditable ? (
                      <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                    ) : null}
                  </View>
                </View>
              );

              return isEditable ? (
                <Pressable
                  key={s.id}
                  onPress={() =>
                    Alert.alert(
                      s.memberName,
                      `${formatTime(s.startTs)} — Yoklama durumunu değiştir`,
                      [
                        {
                          text: 'Geldi ✓',
                          onPress: () =>
                            confirm.mutate(
                              { id: s.id, action: 'present' },
                              { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                            ),
                        },
                        {
                          text: 'Gelmedi ✕',
                          style: 'destructive',
                          onPress: () =>
                            confirm.mutate(
                              { id: s.id, action: 'no_show' },
                              { onError: (e: any) => Alert.alert('Hata', e?.message ?? 'İşlem başarısız') },
                            ),
                        },
                        { text: 'Vazgeç', style: 'cancel' },
                      ],
                    )
                  }
                >
                  {row}
                </Pressable>
              ) : row;
            })
          )
        ) : walkIns.length === 0 ? (
          <Card><Muted>{walkQ.isLoading ? 'Yükleniyor…' : 'Bu tarihte randevusuz giriş yok.'}</Muted></Card>
        ) : (
          walkIns.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.timeCol}>
                  {showDateCol ? (
                    <Text style={styles.dateInRow}>{fmtDateShort(e.accessedAt)}</Text>
                  ) : null}
                  <Text style={styles.time}>{formatTime(e.accessedAt)}</Text>
                </View>
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
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: {
    width: 30, height: 30, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: colors.text, width: 132, textAlign: 'center' },

  top: { gap: 8, paddingTop: 4, paddingBottom: 8 },

  viewModeRow: { flexDirection: 'row', gap: 6 },
  modeBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modeBtnOn: { backgroundColor: 'rgba(124,92,255,0.18)', borderColor: 'rgba(124,92,255,0.5)' },
  modeBtnText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  modeBtnTextOn: { color: colors.text },

  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.text },

  chips: { gap: 6, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.text },
  chipPresent: { borderColor: 'rgba(43,213,118,0.4)', backgroundColor: 'rgba(43,213,118,0.08)' },
  chipNoShow: { borderColor: 'rgba(255,77,109,0.4)', backgroundColor: 'rgba(255,77,109,0.08)' },
  chipPresentOn: { borderColor: 'rgba(43,213,118,0.7)', backgroundColor: 'rgba(43,213,118,0.22)' },
  chipNoShowOn: { borderColor: 'rgba(255,77,109,0.7)', backgroundColor: 'rgba(255,77,109,0.22)' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },

  list: { paddingBottom: 24, gap: 8, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, padding: 12, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowEditable: { borderColor: 'rgba(124,92,255,0.35)' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  timeCol: { alignItems: 'center', minWidth: 46 },
  dateInRow: { color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  time: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowInfo: { flex: 1, gap: 2 },
  member: { color: colors.text, fontSize: 14, fontWeight: '600' },
  staff: { color: colors.muted, fontSize: 12 },
  checkInTime: { color: colors.ok, fontSize: 11, fontWeight: '700' },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  actions: { flexDirection: 'row', gap: 6 },
  actBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  actPresent: { borderColor: 'rgba(43,213,118,0.5)', backgroundColor: 'rgba(43,213,118,0.12)' },
  actNoShow: { borderColor: 'rgba(255,77,109,0.5)', backgroundColor: 'rgba(255,77,109,0.12)' },
});
