import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { FadeIn } from '../../../components/fade-in';
import { ScreenContainer } from '../../../components/screen-container';
import { ApiError } from '../../../lib/api-client';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { requestPasswordReset } from '../api/auth';

export function ForgotPasswordScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Talep gönderilemedi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll center>
      <FadeIn style={styles.card}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.muted} />
          <Text style={styles.backText}>Geri dön</Text>
        </Pressable>

        <Text style={styles.title}>Şifremi Unuttum</Text>

        {sent ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={32} color={colors.fpGreen} style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={styles.successText}>
              Talebiniz alındı. Yönetici en kısa sürede sizinle iletişime geçecektir.
            </Text>
            <Pressable style={styles.loginBtn} onPress={() => router.back()}>
              <Text style={styles.loginBtnText}>Giriş ekranına dön</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              Kayıtlı e-posta adresinizi girin. Yönetici talebinizi görecek ve geçici şifrenizi iletecektir.
            </Text>

            <View style={styles.formRow}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.loginBtn, (loading || !email) && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading || !email}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.loginBtnText}>Talep Gönder</Text>
              )}
            </Pressable>
          </>
        )}
      </FadeIn>
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.45,
      shadowRadius: 40,
      elevation: 8,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    backText: { color: colors.muted, fontSize: 14 },
    title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 10 },
    hint: { color: colors.muted, fontSize: 13, marginBottom: 18, lineHeight: 20 },
    formRow: { marginBottom: 12 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    input: {
      width: '100%',
      backgroundColor: surfaceTint(theme, 0.03),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 16,
    },
    errorBox: {
      marginTop: 4,
      marginBottom: 8,
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    errorText: { color: colors.errorText, fontSize: 13 },
    loginBtn: {
      marginTop: 8,
      backgroundColor: colors.fpGreen,
      borderWidth: 1,
      borderColor: 'rgba(61,184,74,0.45)',
      borderRadius: 12,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.6 },
    successBox: { gap: 10 },
    successText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  });
}
