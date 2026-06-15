import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingDots } from './LoadingDots';
import { colors } from '../theme/colors';

type SplashScreenProps = {
  onFinish?: () => void;
  minDurationMs?: number;
};

export function SplashScreen({ onFinish, minDurationMs = 2400 }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.84)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(10)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;

  const logoWidth = Math.min(width * 0.78, 300);

  useEffect(() => {
    const entrance = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.back(1.05)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(loaderOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    entrance.start();

    const timer = setTimeout(() => {
      onFinish?.();
    }, minDurationMs);

    return () => {
      entrance.stop();
      clearTimeout(timer);
    };
  }, [loaderOpacity, logoOpacity, logoScale, minDurationMs, onFinish, subtitleOpacity, subtitleTranslateY]);

  return (
    <LinearGradient
      colors={['#0B1020', '#0B1020']}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View pointerEvents="none" style={styles.glowGreen} />
      <View pointerEvents="none" style={styles.glowOrange} />

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              width: logoWidth,
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('../../assets/fizyopark-logo.png')}
            style={[styles.logo, { width: logoWidth, height: logoWidth }]}
            resizeMode="contain"
            accessibilityLabel="FizyoPark Ankara"
          />
        </Animated.View>

        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        >
          Fizyoterapist Eşliğinde Reformer Pilates
        </Animated.Text>
      </View>

      <Animated.View style={[styles.footer, { opacity: loaderOpacity }]}>
        <LoadingDots />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.backgroundTop,
  },
  glowGreen: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(61,184,74,0.14)',
  },
  glowOrange: {
    position: 'absolute',
    top: 120,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,149,0,0.1)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoWrap: {
    marginBottom: 18,
  },
  logo: {},
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
    maxWidth: 300,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    minHeight: 72,
  },
});
