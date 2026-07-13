import { useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { DateField } from '../../../components/date-field';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import type { Member } from '../../../types/api';
import { useCreateMember, useMembers, useResetMemberPassword, useUpdateMember } from '../api/hooks';

/** Üye oluştur/düzenle — web üye kartıyla aynı alanlar. */
export function MemberFormScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: members } = useMembers();
  const editing = id ? members?.find((m) => m.id === Number(id)) : undefined;

  const create = useCreateMember();
  const update = useUpdateMember();
  const resetPw = useResetMemberPassword();
  const { isTablet, isLandscape } = useResponsive();

  // Yatay tablet: 2 sütun, scroll yok. Diğer tüm durumlar: tek sütun, scroll.
  const twoCol = isTablet && isLandscape;

  const [form, setForm] = useState<Partial<Member>>(
    editing ?? { firstName: '', lastName: '', phone: '', email: '' },
  );
  const set = (k: keyof Member) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Tab sırası ref'leri
  const r = {
    lastName:       useRef<TextInput>(null),
    phone:          useRef<TextInput>(null),
    email:          useRef<TextInput>(null),
    profession:     useRef<TextInput>(null),
    address:        useRef<TextInput>(null),
    contactName:    useRef<TextInput>(null),
    contactPhone:   useRef<TextInput>(null),
    systemicDis:    useRef<TextInput>(null),
    clinicalCond:   useRef<TextInput>(null),
    pastOps:        useRef<TextInput>(null),
  };
  const focus = (ref: React.RefObject<TextInput | null>) => () => ref.current?.focus();

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

  function onResetPassword() {
    if (!editing) return;
    Alert.alert(
      'Şifre sıfırla',
      `${editing.firstName} ${editing.lastName} için üye giriş şifresi telefonun son 4 hanesine sıfırlanacak. Devam edilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: () =>
            resetPw.mutate(editing.id, {
              onSuccess: (r) =>
                Alert.alert(
                  'Şifre sıfırlandı',
                  `${r.loginUsername ?? 'Üye'} girişi için yeni geçici şifre telefonun son 4 hanesidir. Üye ilk girişte şifresini değiştirmelidir.`,
                ),
              onError: (e) => Alert.alert('Hata', e instanceof ApiError ? e.message : 'Şifre sıfırlanamadı'),
            }),
        },
      ],
    );
  }

  // ── Alan blokları (hem tek sütun hem çift sütun için paylaşılır) ──

  const memberNoRow = editing?.memberNo ? (
    <View style={styles.noRow}>
      <Text style={styles.noLabel}>Üye No</Text>
      <Text style={styles.noValue}>{editing.memberNo}</Text>
    </View>
  ) : null;

  const kisiselFields = (
    <>
      {memberNoRow}
      <FormField label="* Ad" value={form.firstName ?? ''} onChangeText={set('firstName')} autoCapitalize="words"
        returnKeyType="next" onSubmitEditing={focus(r.lastName)} blurOnSubmit={false} />
      <FormField ref={r.lastName} label="* Soyad" value={form.lastName ?? ''} onChangeText={set('lastName')} autoCapitalize="words"
        returnKeyType="next" onSubmitEditing={focus(r.phone)} blurOnSubmit={false} />
      <FormField ref={r.phone} label="* Telefon" placeholder="(xxx)xxx-xx-xx" value={form.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad"
        returnKeyType="next" onSubmitEditing={focus(r.email)} blurOnSubmit={false} />
      <FormField ref={r.email} label="E-Posta (üye girişi için)" placeholder="Giriş kullanıcı adı olarak kullanılır" value={form.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none"
        returnKeyType="next" onSubmitEditing={focus(r.profession)} blurOnSubmit={false} />
      <View>
        <Text style={styles.fieldLabel}>Doğum Tarihi</Text>
        <DateField value={form.birthDate ?? ''} onChange={set('birthDate')} placeholder="Seç" />
      </View>
      <FormField ref={r.profession} label="Mesleği" value={form.profession ?? ''} onChangeText={set('profession')}
        returnKeyType="next" onSubmitEditing={focus(r.address)} blurOnSubmit={false} />
      <FormField label="Kart No" placeholder="RFID kart numarası" value={form.cardNo ?? ''} onChangeText={set('cardNo')} autoCapitalize="characters" />
    </>
  );

  const iletisimFields = (
    <>
      <FormField ref={r.address} label="Adresi" value={form.address ?? ''} onChangeText={set('address')} multiline
        returnKeyType="next" onSubmitEditing={focus(r.contactName)} blurOnSubmit={false} />
      <FormField ref={r.contactName} label="Yakını Adı Soyadı" value={form.contactName ?? ''} onChangeText={set('contactName')} autoCapitalize="words"
        returnKeyType="next" onSubmitEditing={focus(r.contactPhone)} blurOnSubmit={false} />
      <FormField ref={r.contactPhone} label="Yakını Telefon" placeholder="(xxx)xxx-xx-xx" value={form.contactPhone ?? ''} onChangeText={set('contactPhone')} keyboardType="phone-pad"
        returnKeyType="next" onSubmitEditing={focus(r.systemicDis)} blurOnSubmit={false} />
    </>
  );

  const saglikFields = (
    <>
      <FormField ref={r.systemicDis} label="Sistematik Hastalıklar (Kalp, Tansiyon, Şeker vb.)" value={form.systemicDiseases ?? ''} onChangeText={set('systemicDiseases')} multiline
        returnKeyType="next" onSubmitEditing={focus(r.clinicalCond)} blurOnSubmit={false} />
      <FormField ref={r.clinicalCond} label="Klinik Rahatsızlıklar (Fıtık, Kireçlenme vb.)" value={form.clinicalConditions ?? ''} onChangeText={set('clinicalConditions')} multiline
        returnKeyType="next" onSubmitEditing={focus(r.pastOps)} blurOnSubmit={false} />
      <FormField ref={r.pastOps} label="Varsa Geçirdiği Operasyonlar" value={form.pastOperations ?? ''} onChangeText={set('pastOperations')} multiline
        returnKeyType="done" />
      <FormField label="Notlar" value={form.notes ?? ''} onChangeText={set('notes')} multiline />
    </>
  );

  const actionBtns = (
    <>
      {editing ? (
        <Button
          title="Paketler / Paket Tanımla"
          variant="ghost"
          onPress={() => router.push({ pathname: '/(admin)/members/member-packages', params: { memberId: String(editing.id) } })}
          style={styles.packages}
        />
      ) : null}
      {editing?.email ? (
        <Button
          title="Şifre Sıfırla"
          variant="ghost"
          onPress={onResetPassword}
          loading={resetPw.isPending}
          style={styles.packages}
        />
      ) : null}
      <Button
        title={editing ? 'Güncelle' : 'Oluştur'}
        onPress={onSave}
        loading={create.isPending || update.isPending}
        style={styles.submit}
      />
    </>
  );

  return (
    <ScreenContainer scroll={!twoCol} style={twoCol ? { paddingTop: 4, paddingBottom: 4, maxWidth: '100%', alignSelf: 'stretch' } : undefined}>
      <Stack.Screen options={{ title: editing ? 'Üye düzenle' : 'Yeni üye' }} />

      {twoCol ? (
        /* ── Yatay tablet: 3 sütun, scroll yok ── */
        <View style={styles.twoCol}>
          {/* 1. sütun: Kişisel */}
          <View style={styles.col}>
            <Text style={styles.section}>Kişisel</Text>
            <Card style={styles.card}>{kisiselFields}</Card>
          </View>
          {/* 2. sütun: İletişim & Adres */}
          <View style={styles.col}>
            <Text style={styles.section}>İletişim & Adres</Text>
            <Card style={styles.card}>{iletisimFields}</Card>
          </View>
          {/* 3. sütun: Sağlık + Butonlar */}
          <View style={styles.col}>
            <Text style={styles.section}>Sağlık</Text>
            <Card style={styles.card}>{saglikFields}</Card>
            {actionBtns}
          </View>
        </View>
      ) : (
        /* ── Dikey / telefon: tek sütun, scroll ── */
        <>
          <Text style={styles.section}>Kişisel</Text>
          <Card style={styles.card}>{kisiselFields}</Card>
          <Text style={styles.section}>İletişim & Adres</Text>
          <Card style={styles.card}>{iletisimFields}</Card>
          <Text style={styles.section}>Sağlık</Text>
          <Card style={styles.card}>{saglikFields}</Card>
          {actionBtns}
        </>
      )}
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    twoCol: { flexDirection: 'row', gap: 10, flex: 1, overflow: 'hidden' },
    col: { flex: 1, gap: 0 },
    section: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4, letterSpacing: 0.5 },
    card: { gap: 8, marginTop: 0, paddingVertical: 8 },
    fieldLabel: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    noRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    noLabel: { color: colors.muted, fontSize: 12 },
    noValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
    packages: { marginTop: 8 },
    submit: { marginTop: 6, marginBottom: 4 },
  });
}
