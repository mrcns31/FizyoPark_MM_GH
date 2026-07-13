import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import type { Package } from '../../../types/api';
import { useCreatePackage, usePackages, useUpdatePackage } from '../api/hooks';

/** Paket oluştur/düzenle. id param'ı varsa düzenleme. */
export function PackageFormScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: packages } = usePackages();
  const editing = id ? packages?.find((p) => p.id === Number(id)) : undefined;

  const create = useCreatePackage();
  const update = useUpdatePackage();

  const [name, setName] = useState(editing?.name ?? '');
  const [lessonCount, setLessonCount] = useState(editing ? String(editing.lessonCount) : '');
  const [weekly, setWeekly] = useState(editing ? String(editing.weeklyLessonCount) : '');
  const [overrun, setOverrun] = useState(editing ? String(editing.monthOverrun) : '');
  const [type, setType] = useState<'fixed' | 'flexible'>(
    (editing?.packageType as 'fixed' | 'flexible') ?? 'fixed'
  );

  async function onSave() {
    const lc = parseInt(lessonCount, 10);
    if (!name.trim() || !lc || lc < 1) {
      return Alert.alert('Eksik bilgi', 'Paket adı ve en az 1 ders sayısı zorunludur.');
    }
    const data: Partial<Package> = {
      name: name.trim(),
      lessonCount: lc,
      weeklyLessonCount: parseInt(weekly, 10) || 0,
      monthOverrun: parseInt(overrun, 10) || 0,
      packageType: type,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else await create.mutateAsync(data);
      router.back();
    } catch (e) {
      Alert.alert('Hata', e instanceof ApiError ? e.message : 'Kayıt başarısız');
    }
  }

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: editing ? 'Paket düzenle' : 'Yeni paket' }} />
      <Card style={styles.card}>
        <FormField label="Paket adı" required value={name} onChangeText={setName} />
        <FormField label="Ders sayısı" required value={lessonCount} onChangeText={setLessonCount} keyboardType="number-pad" />
        <FormField label="Haftalık ders" value={weekly} onChangeText={setWeekly} keyboardType="number-pad" />
        <FormField label="Ay aşım (gün)" value={overrun} onChangeText={setOverrun} keyboardType="number-pad" />

        <View>
          <Text style={styles.label}>Paket tipi</Text>
          <View style={styles.toggle}>
            {(['fixed', 'flexible'] as const).map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.toggleBtn, type === t && styles.toggleActive]}>
                <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>
                  {t === 'fixed' ? 'Sabit' : 'Esnek'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      <Button title={editing ? 'Güncelle' : 'Oluştur'} onPress={onSave} loading={create.isPending || update.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    card: { gap: 12, marginTop: 8 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    toggle: { flexDirection: 'row', gap: 8 },
    toggleBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: surfaceTint(theme, 0.03),
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleActive: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
    toggleText: { color: colors.muted, fontWeight: '700' },
    toggleTextActive: { color: colors.text },
    submit: { marginTop: 14, marginBottom: 8 },
  });
}
