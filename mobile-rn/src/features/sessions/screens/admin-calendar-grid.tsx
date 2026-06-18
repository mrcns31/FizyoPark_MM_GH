import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useQuery } from '@tanstack/react-query';

import { Muted } from '../../../components/ui';
import { useResponsive } from '../../../lib/responsive';
import { staffColor } from '../../../lib/staff-color';
import { getStaff } from '../../staff/api/staff';
import { useWorkingHours } from '../../settings/api/hooks';
import { colors } from '../../../theme/colors';
import type { PlannerSession } from '../api/sessions';

/**
 * Zaman-rayı takvim (web admin planner paritesi): çalışma saatleri boyunca HER saat
 * solda bir satır olarak görünür; seanslar kendi saat satırına yerleşir, boş saatler
 * de ray hissi için görünür. Aynı saat + personel = tek slot kartı (içinde üyeler).
 */
export function AdminCalendarGrid({
  dayTs,
  sessions,
  onPressGroup,
  fullRail = true,
}: {
  dayTs?: number;
  sessions: PlannerSession[];
  /** Bir slot kartına dokununca o slottaki tüm seanslar (grup) iletilir. */
  onPressGroup?: (group: PlannerSession[]) => void;
  /** true: çalışma saatleri boyunca tüm saatler (günlük). false: sadece dolu saatler (hafta/ay). */
  fullRail?: boolean;
}) {
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const { data: workingHours } = useWorkingHours();
  const { isTablet } = useResponsive();
  const cols = isTablet ? 3 : 2;

  const staffIndex = useMemo(() => {
    const m = new Map<number, number>();
    (staffQ.data ?? []).forEach((st, i) => m.set(st.id, i));
    return m;
  }, [staffQ.data]);

  // Saat aralığı: o günün çalışma saatleri (yoksa 08–20 → 08:00..19:00 satırları).
  const { minHour, maxHour } = useMemo(() => {
    const dow = dayTs != null ? new Date(dayTs).getDay() : new Date().getDay();
    const wh = workingHours?.[dow];
    let open = wh ? parseInt(wh.start.split(':')[0], 10) : 8;
    let close = wh ? parseInt(wh.end.split(':')[0], 10) : 20;
    // Seans saatlerini de kapsadığından emin ol (çalışma saati dışı seans varsa).
    for (const s of sessions) {
      const h = new Date(s.startTs).getHours();
      if (h < open) open = h;
      if (h + 1 > close) close = h + 1;
    }
    return { minHour: open, maxHour: Math.max(open, close - 1) };
  }, [dayTs, workingHours, sessions]);

  const rows = useMemo(() => {
    const all = buildHourRows(sessions, minHour, maxHour);
    return fullRail ? all : all.filter((r) => r.groups.length > 0);
  }, [sessions, minHour, maxHour, fullRail]);

  if (sessions.length === 0 && !workingHours) {
    return (
      <View style={styles.empty}>
        <Muted>Bu gün için seans yok.</Muted>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.hour} style={styles.timeRow}>
          <View style={styles.timePill}>
            <Text style={styles.timePillText}>{row.timeLabel}</Text>
          </View>
          <View style={styles.cards}>
            {row.groups.map((g) => {
              const idx = g.staffId != null ? staffIndex.get(g.staffId) ?? -1 : -1;
              const c = staffColor(idx, g.staffId);
              return (
                <Pressable
                  key={`${row.hour}-${g.staffId ?? 'none'}`}
                  onPress={() => onPressGroup?.(g.sessions)}
                  onLongPress={() => onPressGroup?.(g.sessions)}
                  style={[
                    styles.slotCard,
                    {
                      flexBasis: cols === 3 ? '30%' : '46%',
                      borderColor: c.border,
                      backgroundColor: c.bg,
                    },
                  ]}
                >
                  <View style={styles.slotHead}>
                    <Text style={styles.slotStaff} numberOfLines={1}>
                      {g.staffName || 'Atanmamış'}
                    </Text>
                  </View>
                  <View style={styles.slotMembers}>
                    {g.sessions.map((s) => (
                      <Text key={s.id} style={styles.memberName} numberOfLines={1}>
                        {s.memberName || 'İsimsiz'}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

interface SlotGroup {
  staffId: number | null;
  staffName: string;
  sessions: PlannerSession[];
}
interface HourRow {
  hour: number;
  timeLabel: string;
  groups: SlotGroup[];
}

/** Her saat için bir satır; o saatteki seansları personele göre grupla. */
function buildHourRows(sessions: PlannerSession[], minHour: number, maxHour: number): HourRow[] {
  const rows: HourRow[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    const inHour = sessions.filter((s) => new Date(s.startTs).getHours() === h);
    const groups: SlotGroup[] = [];
    for (const s of inHour) {
      let g = groups.find((x) => x.staffId === s.staffId);
      if (!g) {
        g = { staffId: s.staffId, staffName: s.staffName, sessions: [] };
        groups.push(g);
      }
      g.sessions.push(s);
    }
    groups.sort((a, b) => a.staffName.localeCompare(b.staffName, 'tr'));
    rows.push({ hour: h, timeLabel: `${String(h).padStart(2, '0')}:00`, groups });
  }
  return rows;
}

const styles = StyleSheet.create({
  empty: { padding: 20 },
  list: { padding: 12, gap: 8 },
  timeRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', minHeight: 56 },
  timePill: {
    width: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  timePillText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  cards: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotCard: {
    borderRadius: colors.radius2,
    borderWidth: 1,
    padding: 8,
    minHeight: 56,
    flexGrow: 1,
  },
  slotHead: {
    paddingBottom: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  slotStaff: { color: colors.text, fontWeight: '700', fontSize: 12 },
  slotMembers: { gap: 2 },
  memberName: { color: 'rgba(232,236,255,0.98)', fontWeight: '700', fontSize: 13 },
});
