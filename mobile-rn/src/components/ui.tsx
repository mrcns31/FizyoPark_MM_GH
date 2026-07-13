import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../features/theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../theme/colors';

/**
 * Web admin `styles.css` base class'larıyla BİREBİR tasarım sistemi.
 * Card=.panel, Button=.btn(+--primary/--danger/--ghost), Input=.input, ErrorBox=.error.
 */

/** Web `.panel` — kart yüzeyi. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles();
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** Web `.panel__title`. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles();
  return <Text style={styles.panelTitle}>{children}</Text>;
}

/** Web `.label`. */
export function Label({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles();
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles();
  return <Text style={styles.muted}>{children}</Text>;
}

/** Web `.error` — kırmızı bilgilendirme kutusu (sadece metin değil). */
export function ErrorBox({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles();
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

type BadgeTone = 'green' | 'orange' | 'neutral' | 'red' | 'accent';
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useThemedStyles();
  const badgeTone = useMemo(() => makeBadgeTone(colors, resolvedTheme), [colors, resolvedTheme]);
  const badgeToneText = useMemo(() => makeBadgeToneText(colors), [colors]);
  return (
    <View style={[styles.badge, badgeTone[tone]]}>
      <Text style={[styles.badgeText, badgeToneText[tone]]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useThemedStyles();
  const btnVariant = useMemo(() => makeBtnVariant(resolvedTheme), [resolvedTheme]);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.btn, btnVariant[variant], isDisabled && styles.btnDisabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.btnText}>{title}</Text>
      )}
    </Pressable>
  );
}

function useThemedStyles() {
  const { colors, resolvedTheme } = useTheme();
  return useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
}

function makeStyles(colors: AppColors, resolvedTheme: ResolvedTheme) {
  return StyleSheet.create({
    // .panel
    panel: {
      backgroundColor: colors.panel, // gradient ~ #121a33 (solid yaklaşım)
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius, // 14
      padding: 12,
      gap: 8,
      // box-shadow: 0 10px 30px rgba(0,0,0,.22)
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 30,
      elevation: 4,
    },
    panelTitle: { fontWeight: '700', fontSize: 15, color: colors.text, marginBottom: 10 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    muted: { color: colors.muted, fontSize: 13 },

    // .error
    errorBox: {
      marginTop: 12,
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.errorBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    errorText: { color: colors.errorText, fontSize: 13 },

    badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    badgeText: { fontSize: 12, fontWeight: '600' },

    // .btn
    btn: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(resolvedTheme, 0.04),
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
  });
}

function makeBadgeTone(colors: AppColors, theme: ResolvedTheme): Record<BadgeTone, ViewStyle> {
  return {
    accent: { backgroundColor: colors.accentSoft },
    green: { backgroundColor: 'rgba(43,213,118,0.16)' },
    orange: { backgroundColor: 'rgba(255,149,0,0.16)' },
    red: { backgroundColor: 'rgba(255,77,109,0.16)' },
    neutral: { backgroundColor: surfaceTint(theme, theme === 'dark' ? 0.08 : 0.06) },
  };
}
function makeBadgeToneText(colors: AppColors): Record<BadgeTone, { color: string }> {
  return {
    accent: { color: colors.accent },
    green: { color: colors.ok },
    orange: { color: colors.fpOrange },
    red: { color: colors.danger },
    neutral: { color: colors.muted },
  };
}
// .btn--primary / --danger / --ghost (yarı saydam dolgu + renkli border)
function makeBtnVariant(theme: ResolvedTheme): Record<string, ViewStyle> {
  return {
    default: {},
    primary: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
    danger: { backgroundColor: 'rgba(255,77,109,0.15)', borderColor: 'rgba(255,77,109,0.45)' },
    ghost: { backgroundColor: surfaceTint(theme, theme === 'dark' ? 0.03 : 0.04) },
  };
}
