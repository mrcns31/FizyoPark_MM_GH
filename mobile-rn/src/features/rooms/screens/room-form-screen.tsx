import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import { useCreateRoom, useRooms, useUpdateRoom } from '../api/hooks';

/** Oda oluştur/düzenle (modal sheet). ?id= düzenleme. */
export function RoomFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data } = useRooms();
  const editing = id ? data?.find((r) => r.id === Number(id)) : undefined;

  const create = useCreateRoom();
  const update = useUpdateRoom();

  const [name, setName] = useState(editing?.name ?? '');
  const [devices, setDevices] = useState(editing ? String(editing.devices) : '1');

  async function onSave() {
    const dev = parseInt(devices, 10);
    if (!name.trim() || !dev || dev < 1) return Alert.alert('Eksik bilgi', 'Oda adı ve en az 1 cihaz gerekli.');
    try {
      if (editing) await update.mutateAsync({ id: editing.id, name: name.trim(), devices: dev });
      else await create.mutateAsync({ name: name.trim(), devices: dev });
      router.back();
    } catch (e) {
      Alert.alert('Hata', (e as Error).message);
    }
  }

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: editing ? 'Odayı düzenle' : 'Yeni oda' }} />
      <Card style={styles.card}>
        <FormField label="Oda adı" required value={name} onChangeText={setName} />
        <FormField label="Cihaz sayısı" required value={devices} onChangeText={setDevices} keyboardType="number-pad" />
      </Card>
      <Button
        title={editing ? 'Güncelle' : 'Ekle'}
        onPress={onSave}
        loading={create.isPending || update.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, marginTop: 8 },
  submit: { marginTop: 14, marginBottom: 8 },
});
