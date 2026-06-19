import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../../theme/colors';
import { useNotifications } from '../api/hooks';

interface Toast {
  id: number;
  title: string;
  body: string;
}

/**
 * Yeni bildirim geldiğinde üstte beliren geçici balon (web showTopNotification paritesi).
 * useNotifications zaten 20 sn'de bir polluyor; ilk yüklemedeki mevcutlar toast'lanmaz.
 */
export function NotificationToaster() {
  const { data } = useNotifications();
  const seen = useRef<Set<number> | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    // İlk yükleme: mevcut tüm id'leri "görüldü" say, toast gösterme.
    if (seen.current === null) {
      seen.current = new Set(data.map((n) => n.id));
      return;
    }
    const fresh = data.filter((n) => !seen.current!.has(n.id));
    if (fresh.length) {
      fresh.forEach((n) => seen.current!.add(n.id));
      const n = fresh[0]; // en yeni (liste zaten yeni→eski sıralı)
      setToast({ id: n.id, title: n.title, body: n.body });
    }
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    hideTimer.current = setTimeout(dismiss, 4500);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [toast]);

  function dismiss() {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }

  if (!toast) return null;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });

  return (
    <SafeAreaView style={styles.wrap} edges={['top']} pointerEvents="box-none">
      <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}>
        <Pressable style={styles.inner} onPress={dismiss}>
          <Ionicons name="notifications" size={18} color={colors.accent} />
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? <Text style={styles.body} numberOfLines={2}>{toast.body}</Text> : null}
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12 },
  toast: {
    marginTop: 6,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.45)',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  inner: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  body: { color: colors.muted, fontSize: 13, width: '100%', marginTop: 2 },
});
