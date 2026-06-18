import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { formatDayLabel, formatSessionRange, toDateStr } from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../auth';
import { useConfirmAttendance, useSessions } from '../../sessions/api/hooks';
import type { PlannerSession } from '../../sessions/api/sessions';

const DAY = 24 * 3600 * 1000;

type AttState = 'qr' | 'present' | 'no_show' | 'future' | 'pending';

/** Web renderStaffAttendanceControlsHtml paritesi. */
function attState(s: PlannerSession, now: number): AttState {
  if (s.checkInMethod === 'qr' && s.checkedInAt) return 'qr';
  if (s.checkedInAt) return 'present';
  if (s.attendanceOutcome === 'no_show' || (s.attendanceConfirmedAt && !s.checkedInAt)) return 'no_show';
  if (s.startTs > now) return 'future';
  return 'pending';
}

/** Personel planner — seçili günün seansları, slota göre gruplu, üye başına yoklama. */
export function StaffPlannerScreen() {
  const { user } = useAuth();
  const [dayTs, setDayTs] = useState(() => Date.now());
  const dateStr = toDateStr(dayTs);
  const staffId = user?.staffId ?? undefined;

  const { data, isLoading, refetch, isRefetching } = useSessions({
    startDate: dateStr,
    endDate: dateStr,
    staffId,
  });
  const confirm = useConfirmAttendance();
  const { contentMaxWidth, gutter } = useResponsive();

  function mark(s: PlannerSession, action: 'present' | 'no_show') {
    confirm.mutate(
      { sessionId: s.id, action },
      { onError: (e) => Alert.alert('Hata', (e as Error).message) }
    );
  }

  // Aynı saatteki seansları tek slot kartında grupla (web event__attendance bloğu).
  const slots = useMemo(() => {
    const map = new Map<number, PlannerSession[]>();
    for (const s of data ?? []) {
      if (!map.has(s.startTs)) map.set(s.startTs, []);
      map.get(s.startTs)!.push(s);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ts, list]) => ({ ts, list, end: list[0].endTs, room: list[0].roomName }));
  }, [data]);

  const isToday = dateStr === toDateStr(Date.now());
  const wide = { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Takvim" />
      <View style={[styles.header, wide]}>
        <Pressable onPress={() => setDayTs((t) => t - DAY)} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </Pressable>
        <View style={styles.headCenter}>
          <Text style={styles.dayLabel}>{formatDayLabel(dayTs)}</Text>
          {!isToday ? (
            <Pressable onPress={() => setDayTs(Date.now())} style={styles.todayBtn}>
              <Text style={styles.todayText}>Bugün</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => setDayTs((t) => t + DAY)} hitSlop={10} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.white} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(s) => String(s.ts)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={[styles.list, wide]}
          ListEmptyComponent={
            <Card>
              <Muted>Bu gün için seans yok.</Muted>
            </Card>
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.time}>{formatSessionRange(item.ts, item.end)}</Text>
                {item.room ? <Muted>{item.room}</Muted> : null}
              </View>
              <View style={styles.members}>
                {item.list.map((s) => (
                  <MemberRow key={s.id} session={s} onMark={mark} busy={confirm.isPending} />
                ))}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function MemberRow({
  session,
  onMark,
  busy,
}: {
  session: PlannerSession;
  onMark: (s: PlannerSession, action: 'present' | 'no_show') => void;
  busy?: boolean;
}) {
  const st = attState(session, Date.now());
  return (
    <View style={styles.memberRow}>
      <View style={styles.memberInfo}>
        <Text style={styles.member} numberOfLines={1}>{session.memberName || 'İsimsiz'}</Text>
        {session.note ? <Muted>{session.note}</Muted> : null}
      </View>
      {st === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.markBtn, styles.markOk]}
            disabled={busy}
            onPress={() => onMark(session, 'present')}
          >
            <Ionicons name="checkmark" size={20} color={colors.green} />
          </Pressable>
          <Pressable
            style={[styles.markBtn, styles.markNo]}
            disabled={busy}
            onPress={() => onMark(session, 'no_show')}
          >
            <Ionicons name="close" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ) : st === 'future' ? (
        <Badge label="Bekliyor" tone="neutral" />
      ) : st === 'no_show' ? (
        <Badge label="Gelmedi" tone="red" />
      ) : (
        <Badge label={st === 'qr' ? 'Geldi · QR' : 'Geldi'} tone="green" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCenter: { alignItems: 'center', flex: 1, gap: 4 },
  dayLabel: { fontSize: 16, fontWeight: '750' as '700', color: colors.text },
  todayBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(124,92,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.5)',
  },
  todayText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  list: { paddingVertical: 12, gap: 12, paddingBottom: 24 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  time: { fontSize: 17, fontWeight: '800', color: colors.accent },
  members: { gap: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memberInfo: { flex: 1, minWidth: 0 },
  member: { fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  markBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOk: { borderColor: 'rgba(46,204,113,0.5)', backgroundColor: 'rgba(46,204,113,0.12)' },
  markNo: { borderColor: 'rgba(255,107,122,0.5)', backgroundColor: 'rgba(255,107,122,0.12)' },
});
