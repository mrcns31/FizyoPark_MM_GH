import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashScreen } from './src/components/SplashScreen';
import { colors } from './src/theme/colors';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      // Auth, font veya API hazırlığı buraya eklenebilir
      await new Promise((resolve) => setTimeout(resolve, 400));
      setAppReady(true);
      await ExpoSplashScreen.hideAsync();
    }

    prepare();
  }, []);

  const handleSplashFinish = useCallback(() => {
    if (appReady) {
      setShowSplash(false);
    }
  }, [appReady]);

  if (showSplash || !appReady) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SplashScreen onFinish={handleSplashFinish} minDurationMs={2400} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.main}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.mainText}>FizyoPark uygulaması hazır</Text>
        <Text style={styles.mainHint}>Ana ekranı buraya bağlayın</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundTop,
    padding: 24,
    gap: 12,
  },
  mainText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.greenDark,
  },
  mainHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
