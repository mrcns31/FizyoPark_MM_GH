import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../src/features/theme';
import type { AppColors } from '../src/theme/colors';

/** Açılış — _layout'taki yönlendirme doğru gruba taşır. */
export default function Index() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.green} />
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundTop },
  });
}
