import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { FadeIn } from '../../../components/fade-in';
import { ScreenContainer } from '../../../components/screen-container';
import { Button, ErrorBox, Muted } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import { authKeys, useSetPassword } from '../api/hooks';

/** İlk giriş — zorunlu şifre belirleme (mustChangePassword). */
export function SetPasswordScreen() {
  const qc = useQueryClient();
  const setPw = useSetPassword();
  const [pw, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (pw.length < 6) return setError('Şifre en az 6 karakter olmalı');
    if (pw !== pw2) return setError('Şifreler eşleşmiyor');
    try {
      await setPw.mutateAsync({ newPassword: pw, confirmPassword: pw2 });
      await qc.invalidateQueries({ queryKey: authKeys.me });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'İşlem başarısız');
    }
  }

  return (
    <ScreenContainer scroll center>
      <FadeIn style={styles.card}>
        <Text style={styles.title}>Şifre Belirle</Text>
        <Muted>Devam etmek için yeni bir şifre oluşturun.</Muted>

        <View style={styles.formRow}>
          <Text style={styles.label}>Yeni şifre</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={pw}
            onChangeText={setPw1}
          />
        </View>
        <View style={styles.formRow}>
          <Text style={styles.label}>Yeni şifre (tekrar)</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={pw2}
            onChangeText={setPw2}
          />
        </View>

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button title="Kaydet" onPress={onSubmit} loading={setPw.isPending} disabled={!pw || !pw2} style={styles.submit} />
      </FadeIn>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radius,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 6,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2 },
  formRow: { marginTop: 10 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 16,
  },
  submit: { marginTop: 14 },
});
