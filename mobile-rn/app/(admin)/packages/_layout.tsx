import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../src/components/tabs';
import { modalScreenOptions } from '../../../src/components/modal-nav';
export default function PackagesLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="form" options={{ ...modalScreenOptions, title: 'Paket' }} />
    </Stack>
  );
}
