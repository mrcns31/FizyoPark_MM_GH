import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../theme/colors';
import { dayOfWeekOfTs, formatDayLabel, weekdayLong } from '../../../lib/datetime';
import { useStaffCalendarRange } from '../../settings/api/hooks';

const DAY = 86400000;
const TZ  = 3 * 3600 * 1000;

function startOfDayIst(ts: number): number {
  const d = new Date(ts + TZ);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - TZ;
}

interface StaffDateCtx {
  dayTs: number;
  canBack: boolean;
  canFwd: boolean;
  navDay: (dir: 1 | -1) => void;
  goToday: () => void;
}

const Ctx = createContext<StaffDateCtx | null>(null);

export function StaffDateProvider({ children }: { children: React.ReactNode }) {
  const [dayTs, setDayTs] = useState(() => Date.now());

  const { data: calRange } = useStaffCalendarRange();
  const daysBefore = calRange?.daysBefore ?? null;
  const daysAfter  = calRange?.daysAfter  ?? null;
  const todaySod   = startOfDayIst(Date.now());
  const minDay = daysBefore != null ? todaySod - daysBefore * DAY : null;
  const maxDay = daysAfter  != null ? todaySod + daysAfter  * DAY : null;

  const canBack = minDay == null || startOfDayIst(dayTs) > minDay;
  const canFwd  = maxDay == null || startOfDayIst(dayTs) < maxDay;

  const navDay = useCallback((dir: 1 | -1) => {
    setDayTs((t) => {
      const next = startOfDayIst(t) + dir * DAY;
      if (dir === -1 && minDay != null && next < minDay) return t;
      if (dir ===  1 && maxDay != null && next > maxDay) return t;
      return next + 12 * 3600 * 1000;
    });
  }, [minDay, maxDay]);

  const goToday = useCallback(() => setDayTs(Date.now()), []);

  const value = useMemo(
    () => ({ dayTs, canBack, canFwd, navDay, goToday }),
    [dayTs, canBack, canFwd, navDay, goToday],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStaffDate(): StaffDateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStaffDate must be used inside StaffDateProvider');
  return ctx;
}

/** Ortak < Tarih > navigasyon çubuğu — her iki ekranda aynı bileşen. */
export function StaffDateBar({ wide }: { wide?: object }) {
  const { dayTs, canBack, canFwd, navDay, goToday } = useStaffDate();
  const isToday = startOfDayIst(dayTs) === startOfDayIst(Date.now());

  return (
    <View style={[styles.bar, wide]}>
      <Pressable
        onPress={() => navDay(-1)}
        disabled={!canBack}
        hitSlop={10}
        style={[styles.btn, !canBack && styles.btnOff]}
      >
        <Ionicons name="chevron-back" size={22} color={canBack ? colors.text : colors.muted} />
      </Pressable>

      <Pressable onPress={goToday} style={styles.center} hitSlop={6}>
        <Text style={styles.dateText}>
          {formatDayLabel(dayTs)} {weekdayLong(dayOfWeekOfTs(dayTs))}
        </Text>
        {!isToday ? <Text style={styles.todayHint}>Bugün'e dön</Text> : null}
      </Pressable>

      <Pressable
        onPress={() => navDay(1)}
        disabled={!canFwd}
        hitSlop={10}
        style={[styles.btn, !canFwd && styles.btnOff]}
      >
        <Ionicons name="chevron-forward" size={22} color={canFwd ? colors.text : colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  btn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnOff: { opacity: 0.3 },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  dateText: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  todayHint: { color: colors.accent, fontSize: 11, fontWeight: '600' },
});
