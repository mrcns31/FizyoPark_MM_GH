import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useQuery } from '@tanstack/react-query';

import { staffColor } from '../../../lib/staff-color';
import { getStaff } from '../../staff/api/staff';
import { useWorkingHours } from '../../settings/api/hooks';
import { colors } from '../../../theme/colors';
import type { PlannerSession } from '../api/sessions';

/** "Arzum Çınar" → "Arzum Çın." */
function abbrStaffName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[1].slice(0, 3)}.`;
}

/** Kalan/toplam oranına göre yeşil → turuncu → kırmızı renk döndürür. */
function remainingColor(remaining: number | null, total: number): string {
  if (remaining == null || total <= 0) return colors.muted;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  if (ratio >= 1) return '#4cd473';
  if (ratio >= 0.5) return `hsl(${Math.round(30 + ((ratio - 0.5) / 0.5) * 90)}, 75%, 60%)`;
  if (ratio >= 0.2) return `hsl(${Math.round(((ratio - 0.2) / 0.3) * 30)}, 75%, 60%)`;
  return '#f25c6e';
}

export type MemberPkgInfo = { remaining: number | null; total: number; packageName: string };

/**
 * Zaman-ray takvim: sol kenarda dikey saat etiketi, sağında aynı anda
 * aktif personel sayısı kadar eşit genişlikte kolon (ekran görüntüsü paritesi).
 */
export function AdminCalendarGrid({
  dayTs,
  sessions,
  onPressGroup,
  onLongPressGroup,
  onDeleteGroup,
  fullRail = true,
  memberPackageMap,
  showRemaining = false,
}: {
  dayTs?: number;
  sessions: PlannerSession[];
  onPressGroup?: (group: PlannerSession[]) => void;
  onLongPressGroup?: (group: PlannerSession[]) => void;
  onDeleteGroup?: (group: PlannerSession[]) => void;
  fullRail?: boolean;
  memberPackageMap?: Map<number, MemberPkgInfo>;
  showRemaining?: boolean;
}) {
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const { data: workingHours } = useWorkingHours();

  const staffIndex = useMemo(() => {
    const m = new Map<number, number>();
    (staffQ.data ?? []).forEach((st, i) => m.set(st.id, i));
    return m;
  }, [staffQ.data]);

  const { minHour, maxHour } = useMemo(() => {
    const dow = dayTs != null ? new Date(dayTs).getDay() : new Date().getDay();
    const wh = workingHours?.[dow];
    let open = wh ? parseInt(wh.start.split(':')[0], 10) : 8;
    let close = wh ? parseInt(wh.end.split(':')[0], 10) : 20;
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


  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.hour} style={styles.timeRow}>
          {/* Dikey saat etiketi — sol kenarda 90° döndürülmüş */}
          <View style={styles.timeCol}>
            <Text style={styles.timeText}>{row.timeLabel}</Text>
          </View>

          {/* Personel kolonları — eşit genişlik, wrap yok */}
          <View style={styles.cols}>
            {row.groups.map((g) => {
              const idx = g.staffId != null ? staffIndex.get(g.staffId) ?? -1 : -1;
              const c = staffColor(idx, g.staffId);
              return (
                <Pressable
                  key={`${row.hour}-${g.staffId ?? 'none'}`}
                  onPress={() => onPressGroup?.(g.sessions)}
                  onLongPress={() => onLongPressGroup?.(g.sessions)}
                  style={[styles.slotCard, { borderColor: c.border, backgroundColor: c.bg }]}
                >
                  <View style={styles.slotHead}>
                    <Text style={styles.slotStaff} numberOfLines={1}>
                      {g.staffName ? abbrStaffName(g.staffName) : 'Atanmamış'}
                    </Text>
                    {onDeleteGroup ? (
                      <TouchableOpacity
                        onPress={() => onDeleteGroup(g.sessions)}
                        hitSlop={8}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={13} color="rgba(255,100,120,0.75)" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.slotDivider} />
                  {g.sessions.map((s) => {
                    const pkgInfo = s.memberId != null ? memberPackageMap?.get(s.memberId) : undefined;
                    return (
                      <View key={s.id} style={styles.memberRow}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {s.memberName || 'İsimsiz'}
                        </Text>
                        {showRemaining && pkgInfo != null ? (
                          <Text
                            style={[styles.remainingBadge, { color: remainingColor(pkgInfo.remaining, pkgInfo.total) }]}
                            numberOfLines={1}
                          >
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
  list: { paddingVertical: 0, paddingHorizontal: 0 },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 3,
    paddingRight: 8,
  },

  // Sol: dikey saat etiketi
  timeCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    transform: [{ rotate: '-90deg' }],
    width: 36,
    textAlign: 'center',
  },

  // Sağ: personel kolonları yan yana
  cols: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },

  slotCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 3,
  },
  slotHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotStaff: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  deleteBtn: {
    padding: 2,
    marginLeft: 4,
  },
  slotDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  memberName: {
    color: 'rgba(232,236,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  remainingBadge: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
});
