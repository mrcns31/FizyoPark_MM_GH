import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions, type ReturnKeyTypeOptions } from 'react-native';

import { colors } from '../theme/colors';

/** Form etiket + input — tüm CRUD formlarında kullanılır. */
export const FormField = forwardRef<TextInput | null, {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
}>(({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  required,
  autoCapitalize,
  multiline,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
}, ref) => {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        multiline={multiline}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit ?? !returnKeyType}
      />
    </View>
  );
});

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
    paddingVertical: 10,
    minHeight: 46,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
});
