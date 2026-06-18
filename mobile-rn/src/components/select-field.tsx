import { useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SheetModal } from './sheet-modal';
import { colors } from '../theme/colors';

const WIN_H = Dimensions.get('window').height;

export interface SelectOption<T extends number | string = number> {
  label: string;
  value: T;
}

/** Etiket + modal liste seçici (üye/personel/oda gibi). Değer number veya string. */
export function SelectField<T extends number | string = number>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seçiniz',
  required,
}: {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <SheetModal visible={open} onClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label || 'Seçiniz'}</Text>
          <FlatList
            data={options}
            style={styles.flat}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, item.value === value && styles.optionActive]}>
                  {item.label}
                </Text>
                {item.value === value ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Seçenek yok</Text>}
          />
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  req: { color: colors.danger },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.textMuted },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    // küçük açılmasın: en az ekranın %36'sı, veri artarsa %80'e kadar; içi scroll.
    minHeight: Math.round(WIN_H * 0.36),
    maxHeight: Math.round(WIN_H * 0.8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 10,
  },
  flat: { flexGrow: 0, flexShrink: 1 },
  sheetTitle: { color: colors.white, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  optionText: { color: colors.textSecondary, fontSize: 16 },
  optionActive: { color: colors.white, fontWeight: '700' },
  empty: { color: colors.textMuted, paddingVertical: 20, textAlign: 'center' },
});
