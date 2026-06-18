import { Tabs } from 'expo-router';

import { MemberTabBar } from '../../src/components/member-tab-bar';
import { colors } from '../../src/theme/colors';

/** Üye kabuğu — alt bar: Seanslar · [QR FAB] · Profil. */
export default function MemberLayout() {
  return (
    <Tabs
      tabBar={(props) => <MemberTabBar state={props.state} navigation={props.navigation as never} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen
        name="qr"
        options={{
          headerShown: true,
          title: 'Giriş QR Kodu',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.white,
          headerTitleStyle: { color: colors.white, fontWeight: '700' },
        }}
      />
    </Tabs>
  );
}
