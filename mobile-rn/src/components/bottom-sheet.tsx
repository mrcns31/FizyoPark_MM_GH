import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

/** Alttan açılan sheet — başlık + kapat + kaydırılabilir içerik. Klavyeyle uyumlu. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const [mounted, setMounted] = useState(visible);
  const [kbHeight, setKbHeight] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  // klavye yüksekliğini izle → sheet'i tam klavyenin üstüne otur (boşluk kalmasın)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const winH = Dimensions.get('window').height;
  // İçeriğe göre boyutlanır, klavye üstünde durur, taşarsa içerik scroll eder.
  const sheetMaxHeight = kbHeight > 0 ? winH - kbHeight - 24 : winH * 0.85;
  const sheetMinHeight = kbHeight > 0 ? 0 : winH * 0.55;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY }],
              marginBottom: kbHeight,
              minHeight: sheetMinHeight,
              maxHeight: sheetMaxHeight,
              // klavye açıkken sheet havada → alt köşeler de yuvarlak
              borderBottomLeftRadius: kbHeight > 0 ? 20 : 0,
              borderBottomRightRadius: kbHeight > 0 ? 20 : 0,
            },
          ]}
        >
          <SafeAreaView edges={kbHeight > 0 ? [] : ['bottom']} style={styles.safe}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title}>{title ?? ''}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.overlay },
    sheet: {
      backgroundColor: colors.panel,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    safe: { flexShrink: 1 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: surfaceTint(theme, 0.2),
      marginTop: 8,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: '800' },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 12 },
  });
}
