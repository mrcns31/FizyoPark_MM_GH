import { Stack } from 'expo-router';
import { useTheme } from '../../../src/features/theme';
import { makeStackScreenOptions } from '../../../src/components/tabs';
import { makeModalScreenOptions } from '../../../src/components/modal-nav';
export default function PackagesLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={makeStackScreenOptions(colors)}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="form" options={{ ...makeModalScreenOptions(colors), title: 'Paket' }} />
    </Stack>
  );
}
