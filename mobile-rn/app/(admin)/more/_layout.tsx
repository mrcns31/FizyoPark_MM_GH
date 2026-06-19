import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../src/components/tabs';
import { modalScreenOptions } from '../../../src/components/modal-nav';
export default function MoreLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="requests" options={{ headerShown: false }} />
      <Stack.Screen name="staff" options={{ headerShown: false }} />
      <Stack.Screen name="rooms" options={{ headerShown: false }} />
      <Stack.Screen name="working-hours" options={{ headerShown: false }} />
      <Stack.Screen name="closure-days" options={{ headerShown: false }} />
      <Stack.Screen name="extend-package" options={{ headerShown: false }} />
      <Stack.Screen name="entry-list" options={{ headerShown: false }} />
      <Stack.Screen name="activity-logs" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="staff-form" options={{ ...modalScreenOptions, title: 'Personel' }} />
      <Stack.Screen name="room-form" options={{ ...modalScreenOptions, title: 'Oda' }} />
    </Stack>
  );
}
