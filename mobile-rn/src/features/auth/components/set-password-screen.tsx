import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { FadeIn } from '../../../components/fade-in';
import { ScreenContainer } from '../../../components/screen-container';
import { Button, ErrorBox, Muted } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import { authKeys, useSetPassword } from '../api/hooks';

function validatePassword(pw: string): string | null {
  if (pw.length < 6 || pw.length > 20) return 'Şifre en az 6, en fazla 20 karakter olmalıdır';
  const hasLetter = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pw);
  const hasDigit = /\d/.test(pw);
  if (!hasLetter || !hasDigit) return 'Şifre hem harf hem rakam içermelidir';
  return null;
}

/** İlk giriş — zorunlu şifre belirleme (mustChangePassword). */
export function SetPasswordScreen() {
  const qc = useQueryClient();
  const setPw = useSetPassword();
  const [pw, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const pwErr = validatePassword(pw);
    if (pwErr) return setError(pwErr);
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
        <Muted>
          Hesabınıza geçici şifre ile giriş yaptınız. Devam edebilmek için kalıcı bir şifre belirlemeniz gerekmektedir.
        </Muted>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Yeni Şifre</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Şifrenizi girin"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPw}
              value={pw}
              onChangeText={setPw1}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.eye} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hintBox}>
          <Text style={styles.hintText}>- En az 6, en fazla 20 karakter</Text>
          <Text style={styles.hintText}>- Hem harf hem rakam içermelidir</Text>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Şifrenizi tekrar girin"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPw2}
              value={pw2}
              onChangeText={setPw2}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.eye} onPress={() => setShowPw2((v) => !v)} hitSlop={8}>
              <Ionicons name={showPw2 ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
            </Pressable>
          </View>
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
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2 },
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
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
  submit: { marginTop: 4 },
});
