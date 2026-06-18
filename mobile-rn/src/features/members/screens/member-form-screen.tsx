import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { DateField } from '../../../components/date-field';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import type { Member } from '../../../types/api';
import { useCreateMember, useMembers, useUpdateMember } from '../api/hooks';

/** Üye oluştur/düzenle — web üye kartıyla aynı alanlar (kompakt, gruplu). */
export function MemberFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: members } = useMembers();
  const editing = id ? members?.find((m) => m.id === Number(id)) : undefined;

  const create = useCreateMember();
  const update = useUpdateMember();

  const [form, setForm] = useState<Partial<Member>>(
    editing ?? { firstName: '', lastName: '', phone: '', email: '' },
  );
  const set = (k: keyof Member) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSave() {
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.phone?.trim()) {
      return Alert.alert('Eksik bilgi', 'Ad, soyad ve telefon zorunludur.');
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form });
      else await create.mutateAsync(form);
      router.back();
    } catch (e) {
      Alert.alert('Hata', e instanceof ApiError ? e.message : 'Kayıt başarısız');
    }
  }

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: editing ? 'Üye düzenle' : 'Yeni üye' }} />

      <Text style={styles.section}>Kişisel</Text>
      <Card style={styles.card}>
        {editing?.memberNo ? (
          <View style={styles.noRow}>
            <Text style={styles.noLabel}>Üye No</Text>
            <Text style={styles.noValue}>{editing.memberNo}</Text>
          </View>
        ) : null}
        <FormField label="Ad" required value={form.firstName ?? ''} onChangeText={set('firstName')} autoCapitalize="words" />
        <FormField label="Soyad" required value={form.lastName ?? ''} onChangeText={set('lastName')} autoCapitalize="words" />
        <FormField label="Telefon" required value={form.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" />
        <FormField label="E-posta" value={form.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <View>
          <Text style={styles.fieldLabel}>Doğum tarihi</Text>
          <DateField value={form.birthDate ?? ''} onChange={set('birthDate')} placeholder="Seç" />
        </View>
        <FormField label="Meslek" value={form.profession ?? ''} onChangeText={set('profession')} />
        <FormField label="Kart No (RFID)" value={form.cardNo ?? ''} onChangeText={set('cardNo')} autoCapitalize="characters" />
      </Card>

      <Text style={styles.section}>İletişim & Adres</Text>
      <Card style={styles.card}>
        <FormField label="Adres" value={form.address ?? ''} onChangeText={set('address')} multiline />
        <FormField label="Acil kontak adı" value={form.contactName ?? ''} onChangeText={set('contactName')} autoCapitalize="words" />
        <FormField label="Acil kontak tel" value={form.contactPhone ?? ''} onChangeText={set('contactPhone')} keyboardType="phone-pad" />
      </Card>

      <Text style={styles.section}>Sağlık</Text>
      <Card style={styles.card}>
        <FormField label="Sistemik hastalıklar" value={form.systemicDiseases ?? ''} onChangeText={set('systemicDiseases')} multiline />
        <FormField label="Klinik durumlar" value={form.clinicalConditions ?? ''} onChangeText={set('clinicalConditions')} multiline />
        <FormField label="Geçmiş ameliyatlar" value={form.pastOperations ?? ''} onChangeText={set('pastOperations')} multiline />
        <FormField label="Notlar" value={form.notes ?? ''} onChangeText={set('notes')} multiline />
      </Card>

      {editing ? (
        <Button
          title="Paketler / Paket Tanımla"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/(admin)/members/member-packages',
              params: { memberId: String(editing.id) },
            })
          }
          style={styles.packages}
        />
      ) : null}
      <Button
        title={editing ? 'Güncelle' : 'Oluştur'}
        onPress={onSave}
        loading={create.isPending || update.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8, letterSpacing: 0.5 },
  card: { gap: 14, marginTop: 0 },
  fieldLabel: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  noRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noLabel: { color: colors.muted, fontSize: 12 },
  noValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  packages: { marginTop: 14 },
  submit: { marginTop: 10, marginBottom: 8 },
});
