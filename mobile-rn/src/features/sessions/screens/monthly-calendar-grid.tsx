import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { staffColor } from '../../../lib/staff-color';
import { monthLabel, startOfMonthTs, startOfWeekTs, toDateStr } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import type { PlannerSession } from '../api/sessions';
import type { StaffMember } from '../../staff/api/staff';

const DAY_MS = 24 * 3600 * 1000;
const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** "Arzum Çınar" → "Arzum Ç." */
function abbrevName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[0]} ${(parts[parts.length - 1][0] ?? '')}.`;
}


export function MonthlyCalendarGrid({
  anchor,
  sessions,
  staff,
  onPressDay,
}: {
  anchor: number;
  sessions: PlannerSession[];
  staff: StaffMember[];
  onPressDay: (ts: number) => void;
}) {
  const monthStart = startOfMonthTs(anchor);
  const monthKey = toDateStr(monthStart).slice(0, 7); // "YYYY-MM" (Istanbul)
  const gridStart = startOfWeekTs(monthStart);
  const todayStr = toDateStr(Date.now());

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, PlannerSession[]>();
    for (const s of sessions) {
      const key = toDateStr(s.startTs);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sessions]);

  type StaffStat = { name: string; count: number; idx: number; staffId: number | null };

  const cells = useMemo(() => {
    const result: { ts: number; dateStr: string; inMonth: boolean; dayNum: number; staffStats: StaffStat[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const ts = gridStart + i * DAY_MS;
      const dateStr = toDateStr(ts);
      const inMonth = dateStr.slice(0, 7) === monthKey;
      const daySessions = sessionsByDay.get(dateStr) ?? [];
      // Her gün için personel → randevu sayısı
      const countMap = new Map<number | string, StaffStat>();
      for (const s of daySessions) {
        const key = s.staffId ?? 'none';
        if (!countMap.has(key)) {
          const idx = staff.findIndex((st) => st.id === s.staffId);
          countMap.set(key, { name: s.staffName || 'Atanmamış', count: 0, idx, staffId: s.staffId ?? null });
        }
        countMap.get(key)!.count++;
      }
      const staffStats = [...countMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      const dayNum = Number(dateStr.slice(8, 10));
      result.push({ ts, dateStr, inMonth, dayNum, staffStats });
    }
    return result;
  }, [gridStart, monthKey, sessionsByDay, staff]);

  // Son satır tamamen bir sonraki aya aitse gizle (5 satır yeterli)
  const rowCount = useMemo(() => {
    const lastRow = cells.slice(35);
    const allOutside = lastRow.every((c) => !c.inMonth);
    return allOutside ? 5 : 6;
  }, [cells]);

  const visibleCells = cells.slice(0, rowCount * 7);

  const staffSummary = useMemo(() => {
    const map = new Map<number | string, { name: string; count: number; idx: number; staffId: number | null }>();
    for (const s of sessions) {
      const key = s.staffId ?? 'none';
      if (!map.has(key)) {
        const idx = staff.findIndex((st) => st.id === s.staffId);
        map.set(key, { name: s.staffName || 'Atanmamış', count: 0, idx, staffId: s.staffId ?? null });
      }
      map.get(key)!.count++;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [sessions, staff]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{monthLabel(anchor)}</Text>

      {/* Gün başlıkları */}
      <View style={styles.weekRow}>
        {DAY_NAMES.map((n) => (
          <View key={n} style={styles.headCell}>
            <Text style={styles.headText}>{n}</Text>
          </View>
        ))}
      </View>

      {/* Takvim grid */}
      <View style={styles.grid}>
        {visibleCells.map((cell) => (
          <Pressable
            key={cell.dateStr}
            style={[
              styles.dayCell,
              !cell.inMonth && styles.dayCellMuted,
              cell.dateStr === todayStr && styles.dayCellToday,
            ]}
            onPress={() => onPressDay(cell.ts)}
          >
            <Text
              style={[
                styles.dayNum,
                !cell.inMonth && styles.dayNumMuted,
                cell.dateStr === todayStr && styles.dayNumToday,
              ]}
            >
              {cell.dayNum}
            </Text>
            {cell.staffStats.map(({ name, count, idx, staffId }) => {
              const c = staffColor(idx, staffId);
              return (
                <Text key={String(staffId ?? 'none')} style={[styles.staffLine, { color: c.border }]} numberOfLines={1} ellipsizeMode="tail">
                  {abbrevName(name)}: <Text style={styles.staffCount}>{count}</Text>
                </Text>
              );
            })}
          </Pressable>
        ))}
      </View>

      {/* Personel özeti */}
      {staffSummary.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Personel Özeti</Text>
          <View style={styles.summaryCards}>
            {staffSummary.map(({ name, count, idx, staffId }) => {
              const c = staffColor(idx, staffId);
              return (
                <View key={name} style={[styles.scard, { borderColor: c.border, backgroundColor: c.bg }]}>
                  <Text style={[styles.scardName, { color: c.border }]} numberOfLines={1}>{name}</Text>
                  <View style={styles.scardBody}>
                    <Text style={[styles.scardCount, { color: c.border }]}>{count}</Text>
                    <Text style={styles.scardLabel}>randevu</Text>
                  </View>
                </View>
              );
            })}
            <View style={[styles.scard, styles.scardTotal]}>
              <Text style={styles.scardTotalName}>Toplam</Text>
              <View style={styles.scardBody}>
                <Text style={styles.scardTotalCount}>{sessions.length}</Text>
                <Text style={styles.scardLabel}>randevu</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const CELL_W = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },

  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    textTransform: 'capitalize',
  },

  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headCell: { width: CELL_W, alignItems: 'center', paddingVertical: 6 },
  headText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  dayCell: {
    width: CELL_W,
    minHeight: 90,
    padding: 5,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dayCellMuted: { backgroundColor: 'rgba(255,255,255,0.02)' },
  dayCellToday: { backgroundColor: 'rgba(124,92,255,0.12)' },

  dayNum: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  dayNumMuted: { color: 'rgba(232,236,255,0.3)' },
  dayNumToday: { color: colors.accent, fontWeight: '800' },

  // Personel adı + randevu sayısı — her gün hücresinde
  staffLine: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 15,
  },
  staffCount: {
    fontWeight: '800',
  },

  summary: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  summaryTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    minWidth: 110,
    flex: 1,
  },
  scardName: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  scardBody: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scardCount: { fontSize: 22, fontWeight: '900' },
  scardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  scardTotal: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scardTotalName: { color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  scardTotalCount: { color: colors.text, fontSize: 22, fontWeight: '900' },
});
