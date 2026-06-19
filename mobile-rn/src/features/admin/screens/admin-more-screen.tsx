import { useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { useAuth } from '../../auth';
import { getRooms } from '../../rooms/api/rooms';
import { getStaff } from '../../staff/api/staff';
import { useOpenDoor } from '../api/hooks';

/** Admin "Diğer" — talepler, kapı, personel/oda yönetimi, çıkış. */
export function AdminMoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const roomsQ = useQuery({ queryKey: ['rooms'], queryFn: getRooms });
  const door = useOpenDoor();

  function onOpenDoor() {
    Alert.alert('Kapıyı aç', 'Tesis kapısı açılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Aç',
        onPress: () =>
          door.mutate(undefined, {
            onSuccess: () => Alert.alert('Kapı', 'Kapı açma komutu gönderildi.'),
            onError: (e) => Alert.alert('Hata', (e as Error).message),
          }),
      },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Button title="Talepler (paket / üyelik silme)" onPress={() => router.push('/(admin)/more/requests')} />
      <Button title={`Personel yönetimi (${staffQ.data?.length ?? 0})`} variant="ghost" onPress={() => router.push('/(admin)/more/staff')} />
      <Button title={`Oda yönetimi (${roomsQ.data?.length ?? 0})`} variant="ghost" onPress={() => router.push('/(admin)/more/rooms')} />
      <Button title="🚪 Kapıyı Aç" variant="ghost" onPress={onOpenDoor} loading={door.isPending} />

      <Card>
        <SectionTitle>Hesap</SectionTitle>
        <Muted>{user?.email ?? user?.username}</Muted>
        <Muted>Rol: {user?.role}</Muted>
      </Card>

      <Button title="Çıkış Yap" variant="ghost" onPress={signOut} />
    </ScreenContainer>
  );
}
