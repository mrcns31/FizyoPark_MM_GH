import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../src/components/tabs';
import { modalScreenOptions } from '../../../src/components/modal-nav';
export default function MembersLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="former" options={{ headerShown: false }} />
      <Stack.Screen name="expired" options={{ headerShown: false }} />
      <Stack.Screen name="form" options={{ ...modalScreenOptions, title: 'Üye' }} />
      <Stack.Screen name="member-packages" options={{ ...modalScreenOptions, title: 'Paketler' }} />
      <Stack.Screen name="package-sessions" options={{ ...modalScreenOptions, title: 'Paket Seansları' }} />
      <Stack.Screen name="session-form" options={{ ...modalScreenOptions, title: 'Seans' }} />
    </Stack>
  );
}
