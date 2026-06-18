import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '../src/theme/colors';

/** Açılış — _layout'taki yönlendirme doğru gruba taşır. */
export default function Index() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundTop },
});
