import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import { FadeIn } from '../../../components/fade-in';
import { ScreenContainer } from '../../../components/screen-container';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import { useAuth } from '../stores/auth-context';

/**
 * Üye/personel/admin ortak giriş — web `.login-card` birebir:
 * kare logo, ipucu, e-posta + şifre (göster/gizle), "Beni hatırla",
 * yeşil giriş butonu, yasal linkler.
 */
const LEGAL_LINKS = [
  { label: 'Gizlilik Politikası', url: 'https://fizyopark.com.tr/privacy-policy' },
  { label: 'Açık Rıza Metni', url: 'https://fizyopark.com.tr/explicit-consent-text' },
  { label: 'Üyelik ve Kullanım Koşulları', url: 'https://fizyopark.com.tr/membership-and-terms-of-use' },
  { label: 'Çerez Politikası', url: 'https://fizyopark.com.tr/cookie-policy' },
];

export function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password, remember);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll center>
      <FadeIn style={styles.card}>
        <Image
          source={require('../../../../assets/fizyopark-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.hint}>Hesabınıza giriş yapın.</Text>

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

        <View style={styles.formRow}>
          <Text style={styles.label}>Şifre</Text>
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, styles.pwInput]}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.pwToggle} onPress={() => setShowPw((v) => !v)} hitSlop={8}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.rememberForgotRow}>
          <Pressable style={styles.rememberRow} onPress={() => setRemember((v) => !v)} hitSlop={6}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
            </View>
            <Text style={styles.rememberText}>Beni hatırla</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
            <Text style={styles.forgotText}>Şifremi unuttum</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.loginBtn, loading && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={loading || !email || !password}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.loginBtnText}>Giriş</Text>
          )}
        </Pressable>

        <View style={styles.legal}>
          {LEGAL_LINKS.map((l) => (
            <Text key={l.url} style={styles.legalLink} onPress={() => Linking.openURL(l.url)}>
              {l.label}
            </Text>
          ))}
        </View>
      </FadeIn>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // .login-card
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 40,
    elevation: 8,
  },
  // .login-logo (kare)
  logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: 10 },
  // .login-hint
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 18 },
  // .formRow
  formRow: { marginBottom: 12 },
  // .label
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  // .input
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 16,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 40 },
  pwToggle: { position: 'absolute', right: 8, padding: 4 },
  rememberForgotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  // .login-remember-row + label
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rememberText: { color: colors.muted, fontSize: 13 },
  forgotText: { color: '#8ec5ff', fontSize: 13, textDecorationLine: 'underline' },
  // .error
  errorBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,77,109,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: { color: 'rgba(255,220,226,0.96)', fontSize: 13 },
  // .login-card .btn--primary (yeşil gradient → solid yeşil yaklaşım)
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
  // .login-legal-links
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 6, marginTop: 12 },
  legalLink: { color: '#8ec5ff', fontSize: 12, textDecorationLine: 'underline' },
});
