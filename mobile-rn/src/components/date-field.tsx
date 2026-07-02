import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { SheetModal } from './sheet-modal';
import { colors } from '../theme/colors';

/** "YYYY-MM-DD" → yerel Date. Boşsa bugün. */
function strToDate(v: string): Date {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  return new Date();
}
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
/** 2 Temmuz 2026 Perşembe */
function labelTR(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date);
}

/**
 * Kompakt tarih seçici (web `<input type="date">` karşılığı).
 * Android: native date dialog. iOS: alttan açılan spinner sheet.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'Tarih seç',
  minimumDate,
  trigger,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  /** Özel tetikleyici — sağlanırsa varsayılan buton yerine bu render edilir. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [iosTemp, setIosTemp] = useState<Date>(() => strToDate(value));

  function openPicker() {
    setIosTemp(strToDate(value));
    setOpen(true);
  }

  return (
    <>
      {trigger ? (
        <Pressable onPress={openPicker}>{trigger}</Pressable>
      ) : (
      <Pressable style={styles.btn} onPress={openPicker}>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
        <Text style={[styles.btnText, !value && styles.placeholder]} numberOfLines={1} adjustsFontSizeToFit>
          {value ? labelTR(value) : placeholder}
        </Text>
      </Pressable>
      )}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={strToDate(value)}
          mode="date"
          minimumDate={minimumDate}
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
              mode="date"
              display="spinner"
              themeVariant="dark"
              textColor={colors.text}
              minimumDate={minimumDate}
              onChange={(_, d) => d && setIosTemp(d)}
              style={styles.spinner}
            />
          </View>
        </SheetModal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  btnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  placeholder: { color: colors.muted, fontWeight: '400' },
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
