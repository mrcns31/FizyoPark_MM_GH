import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../features/theme';
import { surfaceTint, type AppColors } from '../../theme/colors';
import { ThemeToggle } from '../theme-toggle';
import { DrawerContext } from './drawer-context';

export type IoniconName = keyof typeof Ionicons.glyphMap;

export interface NavItem {
  key: string;
  label: string;
  icon: IoniconName;
  onPress: () => void;
  active?: boolean;
  badge?: boolean;
  danger?: boolean;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}
const DRAWER_W = Math.min(300, Math.round(Dimensions.get('window').width * 0.82));

/** Mobil kabuğu: drawer (yandan menü). Header'daki hamburger ile açılır. */
export function RoleShell({
  brandText,
  sections,
  footer,
  children,
}: {
  brandText: string;
  sections: NavSection[];
  footer?: NavSection;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0 kapalı, 1 açık

  const hasBadge = useMemo(
    () =>
      sections.some((s) => s.items.some((it) => it.badge)) ||
      !!footer?.items.some((it) => it.badge),
    [sections, footer],
  );

  const api = useMemo(
    () => ({
      open,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
      toggleDrawer: () => setOpen((v) => !v),
      hasBadge,
    }),
    [open, hasBadge],
  );

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_W - 8, 0] });
  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <DrawerContext.Provider value={api}>
      <View style={styles.root}>
        {/* aktif route ekranı */}
        <View style={styles.content}>{children}</View>

        {/* drawer overlay */}
        {mounted ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
            </Animated.View>
            <Animated.View style={[styles.drawer, { width: DRAWER_W, transform: [{ translateX }] }]}>
              <SafeAreaView style={styles.drawerSafe} edges={['top', 'left', 'bottom']}>
                {/* brand */}
                <View style={styles.brand}>
                  <View style={styles.brandIcon}>
                    <Ionicons name="calendar" size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.brandText} numberOfLines={1}>
                    {brandText}
                  </Text>
                  <Pressable onPress={() => setOpen(false)} hitSlop={10} style={styles.close}>
                    <Ionicons name="close" size={20} color={colors.muted} />
                  </Pressable>
                </View>

                <ScrollView style={styles.inner} contentContainerStyle={styles.innerContent}>
                  {sections.map((s) => (
                    <Section key={s.title} section={s} onNavigate={() => setOpen(false)} />
                  ))}
                  {footer ? (
                    <View style={styles.footer}>
                      <Section section={footer} onNavigate={() => setOpen(false)} />
                    </View>
                  ) : null}
                  <View style={styles.themeSection}>
                    <ThemeToggle />
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </DrawerContext.Provider>
  );
}

function Section({ section, onNavigate }: { section: NavSection; onNavigate: () => void }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      {section.items.map((it) => (
        <Pressable
          key={it.key}
          style={[styles.navBtn, it.active && styles.navBtnActive]}
          onPress={() => {
            onNavigate();
            it.onPress();
          }}
        >
          <View style={styles.navIcon}>
            <Ionicons
              name={it.icon}
              size={18}
              color={it.danger ? colors.danger : it.active ? colors.accent : surfaceTint(resolvedTheme, 0.88)}
            />
          </View>
          <Text
            style={[styles.navLabel, it.active && styles.navLabelActive, it.danger && styles.navLabelDanger]}
            numberOfLines={1}
          >
            {it.label}
          </Text>
          {it.badge ? <View style={styles.navBadge} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1 },

    // drawer
    backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.overlay },
    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.panel,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 10, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 36,
      elevation: 16,
    },
    drawerSafe: { flex: 1 },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    brandIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandText: { flex: 1, fontWeight: '800', fontSize: 14, color: colors.text },
    close: { padding: 4 },
    inner: { flex: 1 },
    innerContent: { padding: 8, gap: 2 },
    section: { paddingHorizontal: 8, paddingVertical: 2 },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      minHeight: 40,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    navBtnActive: { backgroundColor: colors.accentSoft, borderColor: 'rgba(124,92,255,0.45)' },
    navIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
    navLabel: { flex: 1, fontSize: 13, color: colors.text },
    navLabelActive: { color: colors.accent, fontWeight: '600' },
    navLabelDanger: { color: colors.danger },
    navBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
    footer: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 4 },
    themeSection: { paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  });
}
