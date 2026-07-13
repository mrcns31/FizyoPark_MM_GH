import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SheetModal } from './sheet-modal';
import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

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
  searchable = false,
}: {
  label: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder?: string;
  required?: boolean;
  /** Açılan listede arama kutusu göster */
  searchable?: boolean;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  function openSheet() {
    setQuery('');
    setOpen(true);
  }

  function closeSheet() {
    setQuery('');
    setOpen(false);
  }

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return options.filter((o) => o.label.toLocaleLowerCase('tr-TR').includes(q));
  }, [options, query, searchable]);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable style={styles.input} onPress={openSheet}>
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <SheetModal visible={open} onClose={closeSheet}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{label || 'Seçiniz'}</Text>

          {searchable ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.muted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ara..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <FlatList
            data={filtered}
            style={styles.flat}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(item.value);
                  closeSheet();
                }}
              >
                <Text style={[styles.optionText, item.value === value && styles.optionActive]}>
                  {item.label}
                </Text>
                {item.value === value ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>Sonuç bulunamadı</Text>}
          />
        </View>
      </SheetModal>
    </View>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    wrap: { marginBottom: 4 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    req: { color: colors.danger },
    input: {
      backgroundColor: surfaceTint(theme, 0.03),
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
      backgroundColor: surfaceTint(theme, 0.2),
      marginBottom: 10,
    },
    sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },

    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: surfaceTint(theme, 0.06),
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      marginBottom: 10,
    },
    searchIcon: {},
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingVertical: 10,
    },

    flat: { flexGrow: 0, flexShrink: 1 },
    option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: surfaceTint(theme, 0.06) },
    optionText: { color: colors.textSecondary, fontSize: 16 },
    optionActive: { color: colors.text, fontWeight: '700' },
    empty: { color: colors.textMuted, paddingVertical: 20, textAlign: 'center' },
  });
}
