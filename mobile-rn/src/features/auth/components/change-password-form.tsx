import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, SectionTitle } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import { useChangePassword } from '../api/hooks';

/** Şifre değiştirme formu. `bare`=true → Card/başlık olmadan (bottom sheet içinde). */
export function ChangePasswordForm({ bare = false }: { bare?: boolean }) {
  const change = useChangePassword();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (pw.length < 6) return setError('Yeni şifre en az 6 karakter olmalı');
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
      <Field placeholder="Mevcut şifre" value={cur} onChange={setCur} />
      <Field placeholder="Yeni şifre" value={pw} onChange={setPw} />
      <Field placeholder="Yeni şifre (tekrar)" value={pw2} onChange={setPw2} />
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
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (t: string) => void;
}) {
  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      secureTextEntry
      value={value}
      onChangeText={onChange}
    />
  );
}

const styles = StyleSheet.create({
  bare: { gap: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
});
