import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

/**
 * Hafif giriş animasyonu — opacity + yukarı kayma. Built-in Animated (ek paket yok).
 * Ekran/kart girişlerinde yumuşak his için kullanılır.
 */
export function FadeIn({
  children,
  delay = 0,
  offset = 12,
  duration = 280,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [progress, duration, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
