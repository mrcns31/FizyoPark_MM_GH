import { useMemo, useState } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { SheetModal } from './sheet-modal';
import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

const WIN_H = Dimensions.get('window').height;

/** "HH:MM" → bugünün tarihinde o saatli Date. */
function strToDate(v: string): Date {
  const [h, m] = (v || '08:00').split(':').map((n) => parseInt(n, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function dateToStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Kompakt saat seçici (web `<input type="time">` karşılığı).
 * Android: native time dialog. iOS: alttan açılan spinner sheet (DateTimeField ile aynı stil).
 */
export function TimeField({
  value,
  onChange,
  disabled,
  minuteInterval,
  hourOnly,
  minHour,
  maxHour,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Dakika adımı (ör. 30 → yalnız 00/30 seçilir). */
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  /** Yalnızca tam saat (08:00, 09:00…) — saat ızgarası seçici gösterir. */
  hourOnly?: boolean;
  /** hourOnly ızgarasında gösterilecek ilk saat (varsayılan 0). */
  minHour?: number;
  /** hourOnly ızgarasında gösterilecek son saat — dahil (varsayılan 23). */
  maxHour?: number;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const [open, setOpen] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(() => strToDate(value));

  function openPicker() {
    if (disabled) return;
    setIosTemp(strToDate(value));
    setOpen(true);
  }

  // Yalnızca tam saat: çalışma saatleri aralığında çip ızgarası, dokun→seç.
  if (hourOnly) {
    const lo = Math.max(0, Math.min(23, minHour ?? 0));
    const hi = Math.max(lo, Math.min(23, maxHour ?? 23));
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => `${String(lo + i).padStart(2, '0')}:00`);
    const current = `${(value || '08:00').split(':')[0].padStart(2, '0')}:00`;
    return (
      <>
        <Pressable
          style={[styles.btn, disabled && styles.btnDisabled]}
          onPress={openPicker}
          disabled={disabled}
        >
          <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>
            {disabled ? '--:--' : current}
          </Text>
        </Pressable>
        <SheetModal visible={open} onClose={() => setOpen(false)}>
          <View style={styles.listSheet}>
            <View style={styles.handle} />
            <Text style={styles.listTitle}>Saat seç</Text>
            <ScrollView style={styles.flat} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {hours.map((item) => {
                const sel = item === current;
                return (
                  <Pressable
                    key={item}
                    style={[styles.hourChip, sel && styles.hourChipOn]}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.hourChipText, sel && styles.hourChipTextOn]}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SheetModal>
      </>
    );
  }

  return (
    <>
      <Pressable
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={openPicker}
        disabled={disabled}
      >
        <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>
          {disabled ? '--:--' : value}
        </Text>
      </Pressable>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={strToDate(value)}
          mode="time"
          is24Hour
          minuteInterval={minuteInterval}
          onChange={(e, d) => {
            setOpen(false);
            if (e.type !== 'dismissed' && d) onChange(dateToStr(d));
          }}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <SheetModal visible={open} onClose={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.cancel}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onChange(dateToStr(iosTemp));
                  setOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.done}>Tamam</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosTemp}
              mode="time"
              is24Hour
              minuteInterval={minuteInterval}
              display="spinner"
              themeVariant="dark"
              textColor={colors.text}
              onChange={(_, d) => d && setIosTemp(d)}
              style={styles.spinner}
            />
          </View>
        </SheetModal>
      ) : null}
    </>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    btn: {
      minWidth: 84,
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    btnTextDisabled: { color: colors.muted },
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

    // hourOnly liste seçici
    listSheet: {
      backgroundColor: colors.panel,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      minHeight: Math.round(WIN_H * 0.36),
      maxHeight: Math.round(WIN_H * 0.7),
      borderWidth: 1,
      borderColor: colors.border,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: surfaceTint(theme, 0.2),
      marginBottom: 10,
    },
    listTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 12 },
    flat: { flexGrow: 0, flexShrink: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
    hourChip: {
      width: '22%',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    hourChipOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
    hourChipText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    hourChipTextOn: { color: colors.accent },
  });
}
