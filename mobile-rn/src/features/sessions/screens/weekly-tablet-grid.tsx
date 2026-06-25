import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { staffColor } from '../../../lib/staff-color';
import { hourOfTs } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import { useWorkingHours } from '../../settings/api/hooks';
import type { PlannerSession } from '../api/sessions';
import type { Room } from '../../../types/api';
import type { StaffMember } from '../../staff/api/staff';
import type { MemberPkgInfo } from './admin-calendar-grid';

const TIME_COL_W = 58;

interface DayData {
  ts: number;
  dateStr: string;
  sessions: PlannerSession[];
}

interface SlotGroup {
  staffId: number | null;
  staffName: string;
  roomId: number | null;
  startTs: number;
  endTs: number;
  sessions: PlannerSession[];
}

interface Props {
  weekDays: DayData[];
  allWeekSessions: PlannerSession[];
  staff: StaffMember[];
  rooms: Room[];
  onPressGroup: (group: PlannerSession[]) => void;
  onDeleteGroup: (group: PlannerSession[]) => void;
  memberPackageMap?: Map<number, MemberPkgInfo>;
  showRemaining?: boolean;
}

function getRoomRemainingCapacity(
  roomId: number | null,
  startTs: number,
  endTs: number,
  allSessions: PlannerSession[],
  rooms: Room[],
): number | null {
  if (roomId == null) return null;
  const room = rooms.find((r) => r.id === roomId);
  if (!room || room.devices < 1) return null;
  const count = allSessions.filter(
    (s) => s.roomId === roomId && s.startTs < endTs && s.endTs > startTs,
  ).length;
  return Math.max(0, room.devices - count);
}

function fmtStaffLabel(
  staffName: string,
  roomId: number | null,
  startTs: number,
  endTs: number,
  allSessions: PlannerSession[],
  rooms: Room[],
): string {
  const parts = staffName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastInit = parts.length > 1 ? ((parts[parts.length - 1] ?? '')[0] ?? '') + '.' : '';
  const name = lastInit ? `${firstName} ${lastInit}` : firstName;
  const rem = getRoomRemainingCapacity(roomId, startTs, endTs, allSessions, rooms);
  return rem != null ? `${name} (${rem})` : name;
}

function buildDayGroups(sessions: PlannerSession[], hour: number): SlotGroup[] {
  const inHour = sessions.filter((s) => hourOfTs(s.startTs) === hour);
  const groups: SlotGroup[] = [];
  for (const s of inHour) {
    let g = groups.find((x) => x.staffId === s.staffId);
    if (!g) {
      g = { staffId: s.staffId, staffName: s.staffName, roomId: s.roomId, startTs: s.startTs, endTs: s.endTs, sessions: [] };
      groups.push(g);
    }
    g.sessions.push(s);
    if (s.endTs > g.endTs) g.endTs = s.endTs;
  }
  groups.sort((a, b) => a.staffName.localeCompare(b.staffName, 'tr'));
  return groups;
}

function fmtDayHeader(ts: number): { dateStr: string; dayName: string } {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dayName = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(d);
  return { dateStr: `${dd}-${mm}-${yyyy}`, dayName };
}


export function WeeklyTabletGrid({
  weekDays,
  allWeekSessions,
  staff,
  rooms,
  onPressGroup,
  onDeleteGroup,
  memberPackageMap,
  showRemaining = false,
}: Props) {
  const { data: workingHours } = useWorkingHours();

  // Sadece çalışılan günleri göster
  const activeDays = useMemo(() => {
    return weekDays.filter((d) => {
      const dow = new Date(d.ts).getDay(); // 0=Pazar, 1=Pzt...
      if (!workingHours) return true;
      const wh = workingHours[dow];
      return wh?.enabled === true;
    });
  }, [weekDays, workingHours]);

  // Saat aralığı: çalışma saatleri + seans saatlerine göre
  const { minHour, maxHour } = useMemo(() => {
    let min = 8;
    let max = 20;
    for (const d of activeDays) {
      for (const s of d.sessions) {
        const h = hourOfTs(s.startTs);
        if (h < min) min = h;
        if (h + 1 > max) max = h + 1;
      }
    }
    if (workingHours) {
      for (const wh of Object.values(workingHours)) {
        if (!wh?.enabled) continue;
        const openH = parseInt(wh.start.split(':')[0], 10);
        const closeH = parseInt(wh.end.split(':')[0], 10);
        if (!isNaN(openH) && openH < min) min = openH;
        if (!isNaN(closeH) && closeH > max) max = closeH;
      }
    }
    return { minHour: min, maxHour: Math.max(min, max - 1) };
  }, [activeDays, workingHours]);

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = minHour; h <= maxHour; h++) arr.push(h);
    return arr;
  }, [minHour, maxHour]);

  const staffIndex = useMemo(() => {
    const m = new Map<number, number>();
    staff.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [staff]);

  return (
    <View style={styles.container}>
      {/* Sabit kolon başlıkları */}
      <View style={styles.headerRow}>
        <View style={styles.timeColHeader}>
          <Text style={styles.timeColLabel}>Saat</Text>
        </View>
        {activeDays.map((d) => {
          const { dateStr, dayName } = fmtDayHeader(d.ts);
          return (
            <View key={d.dateStr} style={styles.dayHeader}>
              <Text style={styles.dayHeaderDate}>{dateStr}</Text>
              <Text style={styles.dayHeaderName}>{dayName}</Text>
            </View>
          );
        })}
      </View>

      {/* Kaydırılabilir saat satırları */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {hours.map((h) => (
          <View key={h} style={styles.timeRow}>
            {/* Saat etiketi */}
            <View style={styles.timeCol}>
              <Text style={styles.timeText}>{String(h).padStart(2, '0')}:00</Text>
            </View>

            {/* Her gün için hücre */}
            {activeDays.map((d) => {
              const groups = buildDayGroups(d.sessions, h);
              return (
                <View key={d.dateStr} style={styles.dayCell}>
                  {groups.map((g) => {
                    const idx = g.staffId != null ? (staffIndex.get(g.staffId) ?? -1) : -1;
                    const c = staffColor(idx, g.staffId);
                    const label = fmtStaffLabel(g.staffName || 'Atanmamış', g.roomId, g.startTs, g.endTs, allWeekSessions, rooms);
                    return (
                      <Pressable
                        key={`${g.staffId ?? 'none'}-${g.startTs}`}
                        onPress={() => onPressGroup(g.sessions)}
                        style={[styles.slotCard, { borderColor: c.border, backgroundColor: c.bg }]}
                      >
                        <View style={styles.slotHead}>
                          <Text style={[styles.slotStaff, { color: c.border }]} numberOfLines={1}>
                            {label}
                          </Text>
                          <TouchableOpacity
                            onPress={() => onDeleteGroup(g.sessions)}
                            hitSlop={8}
                            style={styles.deleteBtn}
                          >
                            <Ionicons name="trash-outline" size={11} color="rgba(255,100,120,0.75)" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.divider} />
                        {g.sessions.map((s) => {
                          const pkgInfo = s.memberId != null ? memberPackageMap?.get(s.memberId) : undefined;
                          return (
                            <View key={s.id} style={styles.memberRow}>
                              <Text style={styles.memberName} numberOfLines={1}>
                                {s.memberName || 'İsimsiz'}
                              </Text>
                              {showRemaining && pkgInfo != null ? (
                                <Text style={styles.remainingBadge} numberOfLines={1}>
                                  {' '}({pkgInfo.remaining ?? '?'}/{pkgInfo.total})
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.panel,
  },
  timeColHeader: {
    width: TIME_COL_W,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    paddingTop: 4,
  },
  timeColLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },

  dayHeader: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  dayHeaderDate: { color: colors.text, fontSize: 11, fontWeight: '800' },
  dayHeaderName: { color: colors.muted, fontSize: 10, fontWeight: '600', marginBottom: 2 },

  // Personel baş harf + sayı — AÇ:9 formatı
  daySummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  daySummaryChip: { fontSize: 10, fontWeight: '800' },
  daySummaryTotal: { fontSize: 10, fontWeight: '700', color: colors.muted },

  scroll: { flex: 1 },

  timeRow: {
    flexDirection: 'row',
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  timeCol: {
    width: TIME_COL_W,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: 4,
  },
  timeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },

  // Her gün hücresi: içindeki personel kartları YAN YANA (row)
  dayCell: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },

  // Her personel kartı eşit genişlik alır (flex: 1)
  slotCard: {
    flex: 1,
    borderRadius: 7,
    borderWidth: 1,
    padding: 5,
    gap: 2,
  },
  slotHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotStaff: { fontSize: 10, fontWeight: '800', flex: 1 },
  deleteBtn: { padding: 2, marginLeft: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 2,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberName: { color: 'rgba(232,236,255,0.92)', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  remainingBadge: { fontSize: 9, fontWeight: '700', color: colors.muted, flexShrink: 0 },
});
