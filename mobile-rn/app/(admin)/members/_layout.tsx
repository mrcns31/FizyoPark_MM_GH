import { Stack } from 'expo-router';
import { useTheme } from '../../../src/features/theme';
import { makeStackScreenOptions } from '../../../src/components/tabs';
import { makeModalScreenOptions } from '../../../src/components/modal-nav';
export default function MembersLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={makeStackScreenOptions(colors)}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="former" options={{ headerShown: false }} />
      <Stack.Screen name="expired" options={{ headerShown: false }} />
      <Stack.Screen name="form" options={{ ...makeModalScreenOptions(colors), title: 'Üye' }} />
      <Stack.Screen name="member-packages" options={{ ...makeModalScreenOptions(colors), title: 'Paketler' }} />
      <Stack.Screen name="package-sessions" options={{ ...makeModalScreenOptions(colors), title: 'Paket Seansları' }} />
      <Stack.Screen name="session-form" options={{ ...makeModalScreenOptions(colors), title: 'Seans' }} />
    </Stack>
  );
}
