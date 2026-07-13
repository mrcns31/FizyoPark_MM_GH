import { Stack } from 'expo-router';
import { useTheme } from '../../../src/features/theme';
import { makeStackScreenOptions } from '../../../src/components/tabs';
import { makeModalScreenOptions } from '../../../src/components/modal-nav';
export default function PlannerLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={makeStackScreenOptions(colors)}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Takvim' }} />
      <Stack.Screen name="session-form" options={{ ...makeModalScreenOptions(colors), title: 'Seans' }} />
    </Stack>
  );
}
