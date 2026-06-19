import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../src/components/tabs';
import { modalScreenOptions } from '../../../src/components/modal-nav';
export default function PlannerLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Takvim' }} />
      <Stack.Screen name="session-form" options={{ ...modalScreenOptions, title: 'Seans' }} />
    </Stack>
  );
}
