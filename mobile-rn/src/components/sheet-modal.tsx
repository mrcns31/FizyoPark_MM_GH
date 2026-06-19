import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

const WIN_H = Dimensions.get('window').height;

/**
 * Alttan kayan sheet kabı. Backdrop YERİNDE fade olur (kaymaz), yalnızca içerik
 * aşağıdan yukarı slide eder — RN `animationType="slide"` tüm modali (backdrop dahil)
 * kaydırdığı için backdrop'un da süzülmesini engeller. Çıkışta da animasyonlu kapanır.
 * `children` doğrudan sheet gövdesidir (kendi arka plan/radius/padding'ini taşır).
 */
export function SheetModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, anim]);

  if (!mounted) return null;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [WIN_H, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.fill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  fill: { flex: 1 },
});
