import { Stack } from 'expo-router';
import { useTheme } from '../../../src/features/theme';
import { makeStackScreenOptions } from '../../../src/components/tabs';
import { makeModalScreenOptions } from '../../../src/components/modal-nav';
export default function MoreLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={makeStackScreenOptions(colors)}>
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
      <Stack.Screen name="broadcasts" options={{ headerShown: false }} />
      <Stack.Screen name="broadcast-members" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="staff-form" options={{ ...makeModalScreenOptions(colors), title: 'Personel' }} />
      <Stack.Screen name="room-form" options={{ ...makeModalScreenOptions(colors), title: 'Oda' }} />
    </Stack>
  );
}
