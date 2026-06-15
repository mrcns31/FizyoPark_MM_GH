import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

const DOT_SIZE = 8;
const DOT_COLORS = [colors.green, colors.orange, colors.green];

type LoadingDotsProps = {
  size?: number;
};

export function LoadingDots({ size = DOT_SIZE }: LoadingDotsProps) {
  const anims = useRef(DOT_COLORS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(anim, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COLORS.length - index - 1) * 160),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.row} accessibilityLabel="Yükleniyor">
      {DOT_COLORS.map((dotColor, index) => {
        const translateY = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        });
        const opacity = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 1],
        });

        return (
          <Animated.View
            key={dotColor + index}
            style={[
              styles.dot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: dotColor,
                opacity,
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 24,
  },
  dot: {},
});
