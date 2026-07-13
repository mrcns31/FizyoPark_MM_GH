import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import {
  WorkingHoursEditor,
  validateWorkingHours,
} from '../../../components/working-hours-editor';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import type { WorkingHours } from '../../settings/api/settings';
import { useCreateStaff, useResetStaffPassword, useStaff, useUpdateStaff } from '../api/hooks';

/** Yeni personel için varsayılan: Pazar kapalı, diğer günler 08:00–20:00 (web ile birebir). */
function defaultStaffHours(): WorkingHours {
  const wh: WorkingHours = {};
  for (let day = 0; day < 7; day++) {
    wh[day] = { enabled: day !== 0, start: '08:00', end: '20:00' };
  }
  return wh;
}

/** Personel oluştur/düzenle (modal sheet). ?id= düzenleme. Çalışma saatleri dahil. */
export function StaffFormScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useStaff();
  const editing = id ? data?.find((s) => s.id === Number(id)) : undefined;

  const create = useCreateStaff();
  const update = useUpdateStaff();
  const resetPw = useResetStaffPassword();

  const [form, setForm] = useState({
    firstName: editing?.firstName ?? '',
    lastName: editing?.lastName ?? '',
    phone: editing?.phone ?? '',
    email: editing?.email ?? '',
    cardNo: editing?.cardNo ?? '',
  });
  const [hours, setHours] = useState<WorkingHours>(
    editing && Object.keys(editing.workingHours).length
      ? editing.workingHours
      : defaultStaffHours(),
  );
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSave() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.email.trim()) {
      return Alert.alert('Eksik bilgi', 'Ad, soyad, telefon ve e-posta zorunludur.');
    }
    const whError = validateWorkingHours(hours);
    if (whError) return Alert.alert('Çalışma saatleri', whError);
    const payload = { ...form, cardNo: form.cardNo.trim() || null, workingHours: hours };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: payload });
      else await create.mutateAsync(payload);
      router.back();
    } catch (e) {
      Alert.alert('Hata', (e as Error).message);
    }
  }

  function onResetPassword() {
    if (!editing) return;
    Alert.alert('Şifre sıfırla', `${editing.fullName} için giriş şifresi sıfırlansın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sıfırla',
        style: 'destructive',
        onPress: () =>
          resetPw.mutate(editing.id, {
            onSuccess: (r) => {
              const pw = r.password || r.tempPassword;
              Alert.alert('Şifre sıfırlandı', pw ? `Yeni geçici şifre: ${pw}` : 'Personele yeni şifre tanımlandı.');
            },
            onError: (e) => Alert.alert('Hata', (e as Error).message),
          }),
      },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: editing ? 'Personeli düzenle' : 'Yeni personel' }} />
      <Card style={styles.card}>
        <FormField label="Ad" required value={form.firstName} onChangeText={set('firstName')} autoCapitalize="words" />
        <FormField label="Soyad" required value={form.lastName} onChangeText={set('lastName')} autoCapitalize="words" />
        <FormField label="Telefon" required value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <FormField label="E-posta" required value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="Kart No (RFID)" value={form.cardNo} onChangeText={set('cardNo')} autoCapitalize="characters" />
        {editing ? (
          <Button title="Giriş şifresini sıfırla" variant="ghost" onPress={onResetPassword} loading={resetPw.isPending} />
        ) : null}
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Çalışma Saatleri</Text>
        <Text style={styles.sectionHint}>
          Personelin uygun olduğu günler ve saatler. Seanslar yalnızca bu saatlerde atanabilir.
        </Text>
        <WorkingHoursEditor hours={hours} onChange={setHours} />
      </View>

      <Button
        title={editing ? 'Güncelle' : 'Ekle'}
        onPress={onSave}
        loading={create.isPending || update.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    card: { gap: 12, marginTop: 8 },
    section: { marginTop: 16, gap: 8 },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
    sectionHint: { color: colors.muted, fontSize: 12 },
    submit: { marginTop: 16, marginBottom: 8 },
  });
}
