import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { SheetModal } from './sheet-modal';
import { formatDayLabel, formatTime } from '../lib/datetime';
import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

type PickerMode = 'date' | 'time';

/**
 * Platformlar-arası tarih/saat alanı.
 * İki buton (Tarih · Saat). Android: native dialog. iOS: spinner'lı modal sheet.
 * Dev inline takvim KULLANILMAZ (çirkin + her platformda tutarsız).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minuteInterval,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  /** Saat modunda dakika adımı (ör. 30 → 00/30). */
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const [mode, setMode] = useState<PickerMode | null>(null);
  const [iosTemp, setIosTemp] = useState<Date>(value);

  function open(m: PickerMode) {
    setIosTemp(value);
    setMode(m);
  }

  function onAndroidChange(e: { type: string }, d?: Date) {
    setMode(null);
    if (e.type !== 'dismissed' && d) onChange(d);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.btn} onPress={() => open('date')}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={styles.btnText}>{formatDayLabel(value.getTime())}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.timeBtn]} onPress={() => open('time')}>
          <Ionicons name="time-outline" size={18} color={colors.muted} />
          <Text style={styles.btnText}>{formatTime(value.getTime())}</Text>
        </Pressable>
      </View>

      {/* Android: native dialog */}
      {Platform.OS === 'android' && mode ? (
        <DateTimePicker
          value={value}
          mode={mode}
          minuteInterval={mode === 'time' ? minuteInterval : undefined}
          onChange={onAndroidChange}
        />
      ) : null}

      {/* iOS: alttan açılan spinner sheet */}
      {Platform.OS === 'ios' ? (
        <SheetModal visible={!!mode} onClose={() => setMode(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setMode(null)} hitSlop={8}>
                <Text style={styles.cancel}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onChange(iosTemp);
                  setMode(null);
                }}
                hitSlop={8}
              >
                <Text style={styles.done}>Tamam</Text>
              </Pressable>
            </View>
            {mode ? (
              <DateTimePicker
                value={iosTemp}
                mode={mode}
                minuteInterval={mode === 'time' ? minuteInterval : undefined}
                display="spinner"
                themeVariant="dark"
                textColor={colors.text}
                onChange={(_, d) => d && setIosTemp(d)}
                style={styles.spinner}
              />
            ) : null}
          </View>
        </SheetModal>
      ) : null}
    </View>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    wrap: { gap: 6 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 2 },
    row: { flexDirection: 'row', gap: 8 },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
    },
    timeBtn: { flex: 0, minWidth: 110, justifyContent: 'center' },
    btnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    sheet: {
      backgroundColor: colors.panel,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingBottom: 24,
    },
    sheetHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancel: { color: colors.muted, fontSize: 16 },
    done: { color: colors.accent, fontSize: 16, fontWeight: '700' },
    spinner: { alignSelf: 'center' },
  });
}
