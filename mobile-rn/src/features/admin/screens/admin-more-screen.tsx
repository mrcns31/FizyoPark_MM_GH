import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { useAuth } from '../../auth';
import { getRooms } from '../../rooms/api/rooms';
import { getStaff } from '../../staff/api/staff';

/** Admin "Diğer" — talepler, personel/oda yönetimi, çıkış. */
export function AdminMoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: getStaff });
  const roomsQ = useQuery({ queryKey: ['rooms'], queryFn: getRooms });

  return (
    <ScreenContainer scroll>
      <Button title="Talepler (paket / üyelik silme)" onPress={() => router.push('/(admin)/more/requests')} />
      <Button title={`Personel yönetimi (${staffQ.data?.length ?? 0})`} variant="ghost" onPress={() => router.push('/(admin)/more/staff')} />
      <Button title={`Oda yönetimi (${roomsQ.data?.length ?? 0})`} variant="ghost" onPress={() => router.push('/(admin)/more/rooms')} />

      <Card>
        <SectionTitle>Hesap</SectionTitle>
        <Muted>{user?.email ?? user?.username}</Muted>
        <Muted>Rol: {user?.role}</Muted>
      </Card>

      <Button title="Çıkış Yap" variant="ghost" onPress={signOut} />
    </ScreenContainer>
  );
}
