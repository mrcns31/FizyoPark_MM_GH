import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { FadeIn } from '../../../components/fade-in';
import { ErrorBox } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useAuth } from '../stores/auth-context';
import { authKeys, useAcceptConsent } from '../api/hooks';

/** KVKK / Gizlilik onay ekranı — web `legalConsentScreen` (pw-change) birebir. */
const CONSENT_ITEMS = [
  { key: 'privacy', label: 'Gizlilik Politikası', url: 'https://fizyopark.com.tr/privacy-policy' },
  { key: 'terms', label: 'Üyelik ve Kullanım Koşulları', url: 'https://fizyopark.com.tr/membership-and-terms-of-use' },
  { key: 'explicit', label: 'Kişisel Verilerin İşlenmesine İlişkin Açık Rıza Metni', url: 'https://fizyopark.com.tr/explicit-consent-text' },
  { key: 'cookie', label: 'Çerez Politikası', url: 'https://fizyopark.com.tr/cookie-policy' },
] as const;

export function ConsentScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const accept = useAcceptConsent();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allChecked = CONSENT_ITEMS.every((i) => checked[i.key]);
  const [attempted, setAttempted] = useState(false);

  function toggle(key: string) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  async function onAccept() {
    if (!allChecked) {
      setAttempted(true);
      return;
    }
    setError(null);
    try {
      await accept.mutateAsync();
      await qc.invalidateQueries({ queryKey: authKeys.me });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'İşlem başarısız');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gizlilik ve Kişisel Verilerin Korunması</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeIn>
          {/* hero */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={34} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>Verilerinizin Korunması</Text>
          </View>

          {/* info */}
          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color="#6b9fff" style={styles.infoIcon} />
            <Text style={styles.infoText}>
              FizyoPark olarak kişisel verilerinizi (ad soyad, iletişim bilgileri, üyelik/seans
              kayıtları, QR kod ile tesis giriş kayıtları, cihaz ve IP bilgileri) yalnızca
              hizmetlerimizin yürütülmesi, seans planlaması, tesis güvenliği ve yasal
              yükümlülüklerimiz kapsamında işliyoruz. Devam etmeden önce lütfen aşağıdaki metinleri
              inceleyin.
            </Text>
          </View>

          {/* form card */}
          <View style={styles.formCard}>
            {CONSENT_ITEMS.map((item) => {
              const isError = attempted && !checked[item.key];
              return (
                <View
                  key={item.key}
                  style={[styles.consentItem, isError && styles.consentItemError]}
                >
                  <Text style={styles.consentLink} onPress={() => Linking.openURL(item.url)}>
                    {item.label}
                  </Text>
                  <Pressable style={styles.checkboxField} onPress={() => toggle(item.key)} hitSlop={4}>
                    <View style={[styles.checkbox, checked[item.key] && styles.checkboxOn, isError && styles.checkboxError]}>
                      {checked[item.key] ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
                    </View>
                    <Text style={[styles.checkboxText, isError && styles.checkboxTextError]}>
                      Okudum ve kabul ediyorum.
                    </Text>
                  </Pressable>
                  {isError ? (
                    <Text style={styles.requiredLabel}>* Zorunlu alan</Text>
                  ) : null}
                </View>
              );
            })}

            {error ? <ErrorBox>{error}</ErrorBox> : null}

            <Pressable
              style={[styles.submit, accept.isPending && styles.submitDisabled]}
              onPress={onAccept}
              disabled={accept.isPending}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.submitText}>Kabul Ediyorum ve Devam Et</Text>
            </Pressable>
          </View>

          <Text style={styles.logout} onPress={signOut}>
            Çıkış yap
          </Text>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
    scroll: { padding: 16, paddingBottom: 28 },
    // hero
    hero: { alignItems: 'center', marginBottom: 18 },
    heroIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#5b6dff', // gradient (#4a69ff→#7c5cff) yaklaşımı
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      shadowColor: '#4a69ff',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 32,
      elevation: 6,
    },
    heroTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    // info
    info: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: 'rgba(74,105,255,0.22)',
      borderRadius: 14,
      backgroundColor: 'rgba(74,105,255,0.08)',
    },
    infoIcon: { marginTop: 1 },
    infoText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.link },
    // form card
    formCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      backgroundColor: surfaceTint(theme, 0.03),
      gap: 14,
    },
    consentItem: {
      gap: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: surfaceTint(theme, 0.03),
    },
    consentItemError: {
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.07)',
    },
    consentLink: { fontSize: 14, fontWeight: '700', color: '#6b9fff', textDecorationLine: 'underline' },
    checkboxField: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkbox: {
      width: 18,
      height: 18,
      marginTop: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: '#4a69ff', borderColor: '#4a69ff' },
    checkboxError: { borderColor: '#ef4444', borderWidth: 2 },
    checkboxText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.text },
    checkboxTextError: { color: '#ef4444' },
    requiredLabel: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
    // submit
    submit: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      minHeight: 48,
      marginTop: 2,
      borderRadius: 12,
      backgroundColor: '#4a69ff',
      shadowColor: '#4a69ff',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 5,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: colors.white, fontSize: 15, fontWeight: '800' },
    logout: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 18, textDecorationLine: 'underline' },
  });
}
