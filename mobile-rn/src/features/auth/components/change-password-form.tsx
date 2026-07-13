import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, SectionTitle } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useChangePassword } from '../api/hooks';

function validatePassword(pw: string): string | null {
  if (pw.length < 6 || pw.length > 20) return 'Şifre en az 6, en fazla 20 karakter olmalıdır';
  const hasLetter = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pw);
  const hasDigit = /\d/.test(pw);
  if (!hasLetter || !hasDigit) return 'Şifre hem harf hem rakam içermelidir';
  return null;
}

/** Şifre değiştirme formu. `bare`=true → Card/başlık olmadan (bottom sheet içinde). */
export function ChangePasswordForm({ bare = false }: { bare?: boolean }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const change = useChangePassword();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const pwErr = validatePassword(pw);
    if (pwErr) return setError(pwErr);
    if (pw !== pw2) return setError('Yeni şifreler eşleşmiyor');
    try {
      await change.mutateAsync({ currentPassword: cur, newPassword: pw, confirmPassword: pw2 });
      setCur('');
      setPw('');
      setPw2('');
      Alert.alert('Başarılı', 'Şifreniz güncellendi.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'İşlem başarısız');
    }
  }

  const body = (
    <>
      <Field
        label="Mevcut Şifre"
        placeholder="Mevcut şifrenizi girin"
        value={cur}
        onChange={setCur}
        show={showCur}
        onToggle={() => setShowCur((v) => !v)}
      />
      <Field
        label="Yeni Şifre"
        placeholder="Yeni şifrenizi girin"
        value={pw}
        onChange={setPw}
        show={showPw}
        onToggle={() => setShowPw((v) => !v)}
      />
      <View style={styles.hintBox}>
        <Text style={styles.hintText}>- En az 6, en fazla 20 karakter</Text>
        <Text style={styles.hintText}>- Hem harf hem rakam içermelidir</Text>
        <Text style={styles.hintText}>- Eski şifrenizden farklı olmalıdır</Text>
      </View>
      <Field
        label="Yeni Şifre (Tekrar)"
        placeholder="Yeni şifrenizi tekrar girin"
        value={pw2}
        onChange={setPw2}
        show={showPw2}
        onToggle={() => setShowPw2((v) => !v)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title="Güncelle"
        onPress={onSubmit}
        loading={change.isPending}
        disabled={!cur || !pw || !pw2}
      />
    </>
  );

  if (bare) return <View style={styles.bare}>{body}</View>;

  return (
    <Card>
      <SectionTitle>Şifre Değiştir</SectionTitle>
      {body}
    </Card>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.eye} onPress={onToggle} hitSlop={8}>
          <Ionicons name={show ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    bare: { gap: 12 },
    fieldWrap: { gap: 6 },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '500',
    },
    inputWrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      backgroundColor: surfaceTint(theme, 0.07),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: surfaceTint(theme, 0.18),
      paddingHorizontal: 12,
      paddingVertical: 13,
      paddingRight: 44,
      color: colors.text,
      fontSize: 16,
    },
    eye: {
      position: 'absolute',
      right: 12,
      padding: 4,
    },
    hintBox: {
      backgroundColor: 'rgba(124,92,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(124,92,255,0.25)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 3,
    },
    hintText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
      backgroundColor: 'rgba(255,77,109,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,77,109,0.25)',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
  });
}
