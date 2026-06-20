import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { FormField } from '../../../components/form';
import { Button, Card, ErrorBox, SectionTitle } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { ChangePasswordForm } from '../../auth/components/change-password-form';
import { useAuth } from '../../auth';
import { authKeys } from '../../auth/api/hooks';
import { updateAccountProfile } from '../../auth/api/auth';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { getInstitutionWhatsApp } from '../api/settings';

/** Hesap İşlemleri / Profil (admin) — web `openAdminAccountScreen`. Bilgi güncelle + şifre + çıkış. */
export function AccountScreen() {
  const router = useRouter();
  const { user, role, signOut } = useAuth();
  const qc = useQueryClient();
  const { contentMaxWidth, gutter } = useResponsive();
  const isAdminOrManager = role === 'admin' || role === 'manager';

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdminOrManager) getInstitutionWhatsApp().then(setWhatsapp).catch(() => {});
  }, [isAdminOrManager]);

  async function onSave() {
    setError(null);
    if (!fullName.trim()) return setError('Ad soyad gerekli.');
    if (!email.trim()) return setError('E-posta gerekli.');
    setSaving(true);
    try {
      const body: Record<string, unknown> = { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() };
      if (isAdminOrManager) body.whatsapp = whatsapp.trim();
      await updateAccountProfile(body);
      await qc.invalidateQueries({ queryKey: authKeys.me });
      Alert.alert('Kaydedildi', 'Bilgileriniz güncellendi.');
    } catch (e) {
      setError((e as Error).message || 'Güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Hesap İşlemleri" onBack={() => router.push('/(admin)/more/settings')} />
      <ScrollView contentContainerStyle={[styles.content, wide]} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <SectionTitle>Bilgilerim</SectionTitle>
          <FormField label="Ad Soyad" required value={fullName} onChangeText={setFullName} autoCapitalize="words" />
          <FormField label="E-posta" required value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          {isAdminOrManager ? (
            <FormField
              label="Kurum WhatsApp (üye iptal yönlendirme)"
              value={whatsapp}
              onChangeText={setWhatsapp}
              keyboardType="phone-pad"
              placeholder="Örn. 905001234567"
            />
          ) : null}
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <Button title="Bilgileri Güncelle" variant="primary" onPress={onSave} loading={saving} />
        </Card>

        <ChangePasswordForm />

        <Button title="Çıkış Yap" variant="danger" onPress={onLogout} style={styles.logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: 16, gap: 14, flexGrow: 1 },
  card: { gap: 12 },
  logout: { marginTop: 4, marginBottom: 8 },
});
