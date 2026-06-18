import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors } from '../theme/colors';

/** Form etiket + input — tüm CRUD formlarında kullanılır. */
export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  required,
  autoCapitalize,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  // web .label
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  req: { color: colors.danger },
  // web .input
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 46,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
});
