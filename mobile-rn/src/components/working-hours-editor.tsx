import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TimeField } from './time-field';
import { colors } from '../theme/colors';
import { defaultDayHours, type DayHours, type WorkingHours } from '../features/settings/api/settings';

// Web ile birebir: 0=Pazar .. 6=Cumartesi.
export const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function timeToMinutes(t: string): number {
  const [h, m] = (t || '').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/** enabled günlerde başlangıç/bitiş geçerli mi — hata mesajı döndürür (yoksa null). */
export function validateWorkingHours(hours: WorkingHours): string | null {
  for (let day = 0; day < 7; day++) {
    const wh = hours[day];
    if (!wh || !wh.enabled) continue;
    if (!wh.start || !wh.end) return `${DAY_NAMES[day]} için başlangıç ve bitiş saati girin.`;
    if (timeToMinutes(wh.end) <= timeToMinutes(wh.start))
      return `${DAY_NAMES[day]} için bitiş saati, başlangıçtan sonra olmalı.`;
  }
  return null;
}

/**
 * 7 günlük çalışma saati editörü (web `renderWorkingHoursList` birebir).
 * Hem genel Çalışma Saatleri ekranında hem personel formunda kullanılır.
 */
export function WorkingHoursEditor({
  hours,
  onChange,
}: {
  hours: WorkingHours;
  onChange: (hours: WorkingHours) => void;
}) {
  function setDay(day: number, patch: Partial<DayHours>) {
    onChange({ ...hours, [day]: { ...(hours[day] ?? defaultDayHours()), ...patch } });
  }
  function toggle(day: number) {
    const cur = hours[day] ?? defaultDayHours();
    setDay(day, cur.enabled
      ? { enabled: false }
      : { enabled: true, start: cur.start || '08:00', end: cur.end || '20:00' });
  }

  return (
    <View style={styles.list}>
      {Array.from({ length: 7 }, (_, day) => {
        const wh = hours[day] ?? defaultDayHours();
        const enabled = wh.enabled;
        return (
          <View key={day} style={[styles.row, day === 6 && styles.rowLast]}>
            <Pressable style={styles.left} onPress={() => toggle(day)} hitSlop={6}>
              <View style={[styles.check, enabled && styles.checkOn]}>
                {enabled ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
              </View>
              <Text style={styles.dayName}>{DAY_NAMES[day]}</Text>
            </Pressable>
            <View style={styles.times}>
              <TimeField value={wh.start} disabled={!enabled} onChange={(v) => setDay(day, { start: v })} />
              <Text style={styles.sep}>–</Text>
              <TimeField value={wh.end} disabled={!enabled} onChange={(v) => setDay(day, { end: v })} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  sep: { color: colors.muted, fontSize: 15 },
});
