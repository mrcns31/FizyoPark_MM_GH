import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ScreenHeader } from './screen-header';
import { useResponsive } from '../lib/responsive';
import { colors } from '../theme/colors';

/**
 * Koyu temalı, güvenli alanlı, responsive ekran kabı.
 * Klavye açılınca içerik kapanmaz + odaklanan input'a otomatik kaydırır.
 * - iOS: ScrollView `automaticallyAdjustKeyboardInsets` (native — pageSheet/modal
 *   içinde doğru çalışır; KeyboardAvoidingView modal'da yanlış padding eklediği için
 *   scroll modunda kullanılmaz). UIKit klavye insets'ini ayarlayıp odaklanan alana
 *   otomatik kaydırır.
 * - Android: KeyboardAvoidingView (behavior=height) fallback.
 * `title` verilirse üstte ortak ScreenHeader (hamburger + başlık) + üst safe-area.
 */
export function ScreenContainer({
  children,
  center,
  scroll,
  title,
  style,
}: {
  children: React.ReactNode;
  center?: boolean;
  scroll?: boolean;
  title?: string;
  style?: ViewStyle;
}) {
  const { contentMaxWidth, gutter } = useResponsive();
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: gutter,
    flex: scroll ? undefined : 1,
  };

  const content = <View style={[inner, !scroll && center && styles.center, style]}>{children}</View>;
  // Scroll modunda alt safe-area edge'i KOYMA → içerik liste ekranları gibi telefonun
  // en altına kadar aksın (alt boşluk paddingBottom ile veriliyor). Scroll değilse
  // (sabit içerik) bottom inset'e saygı duy.
  const edges: Edge[] = ['left', 'right'];
  if (title) edges.push('top');
  if (!scroll) edges.push('bottom');

  const scrollEl = (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, center && styles.scrollCenter]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      // iOS: klavye açılınca inset'i ayarlar + odaklanan input'a otomatik kaydırır.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
    >
      {content}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {title ? <ScreenHeader title={title} /> : null}
      {scroll ? (
        // iOS native inset zaten klavyeyi yönetiyor; KeyboardAvoidingView modal içinde
        // çift padding eklediği için sadece Android'de saralım.
        Platform.OS === 'android' ? (
          <KeyboardAvoidingView style={styles.flex} behavior="height">
            {scrollEl}
          </KeyboardAvoidingView>
        ) : (
          scrollEl
        )
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 16, paddingBottom: 40 },
  scrollCenter: { justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
