import { useMemo } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import {
  useApproveDeletion,
  useDeletionRequests,
  useDismissPackageRequest,
  useHandlePasswordResetRequest,
  usePackageRequests,
  usePasswordResetRequests,
  useRejectDeletion,
} from '../api/hooks';

// ── WhatsApp bildirim yardımcıları ────────────────────────────────────────

/** Kayıtlı telefonu wa.me formatına çevirir: sadece rakam, ülke kodlu (90...). */
function toWhatsAppNumber(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('90')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return '90' + d;
}

/** Şifre sıfırlama bildirimini üyeye WhatsApp'tan iletmek için wa.me linkini açar. */
function sendResetWhatsApp(result: { name: string; phone: string; temporaryPassword: string }) {
  const num = toWhatsAppNumber(result.phone);
  if (!num) {
    Alert.alert(
      'Telefon bulunamadı',
      'Bu üyenin kayıtlı telefon numarası olmadığı için WhatsApp mesajı hazırlanamadı. Geçici şifreyi elle iletin.'
    );
    return;
  }
  const greeting = result.name ? `Merhaba ${result.name}` : 'Merhaba';
  const msg =
    `${greeting}, FizyoPark uygulama şifreniz sıfırlandı. Geçici şifreniz: ${result.temporaryPassword}. ` +
    `Girmeden önce telefonunuzdaki eski kayıtlı şifreyi silmeniz gerekmektedir, sonra geçici şifre ile girip yeni şifrenizi belirleyebilirsiniz 🙏`;
  Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`).catch(() => {
    Alert.alert('WhatsApp açılamadı', 'WhatsApp uygulaması açılamadı. Geçici şifreyi elle iletin.');
  });
}

// ── Tip tanımları ─────────────────────────────────────────────────────────

type SectionAccent = {
  color: string;
  bg: string;
  border: string;
  iconBg: string;
};

function makeAccents(colors: AppColors): Record<'package' | 'password' | 'deletion', SectionAccent> {
  return {
    package: {
      color: colors.accent,
      bg: 'rgba(124,92,255,0.06)',
      border: 'rgba(124,92,255,0.35)',
      iconBg: 'rgba(124,92,255,0.15)',
    },
    password: {
      color: colors.fpOrange,
      bg: 'rgba(255,149,0,0.06)',
      border: 'rgba(255,149,0,0.35)',
      iconBg: 'rgba(255,149,0,0.15)',
    },
    deletion: {
      color: colors.danger,
      bg: 'rgba(255,77,109,0.06)',
      border: 'rgba(255,77,109,0.35)',
      iconBg: 'rgba(255,77,109,0.15)',
    },
  };
}

// ── Section container bileşeni ────────────────────────────────────────────

function RequestSection({
  icon,
  title,
  count,
  accentKey,
  empty,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  count: number;
  accentKey: 'package' | 'password' | 'deletion';
  empty: string;
  children: React.ReactNode;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const ACCENTS = useMemo(() => makeAccents(colors), [colors]);
  const a = ACCENTS[accentKey];
  return (
    <View style={[styles.section, { backgroundColor: a.bg, borderColor: a.border }]}>
      {/* Başlık satırı */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: a.iconBg }]}>
          <Ionicons name={icon} size={18} color={a.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: a.color }]}>{title}</Text>
        <View style={[styles.countBadge, { backgroundColor: a.iconBg }]}>
          <Text style={[styles.countText, { color: a.color }]}>{count}</Text>
        </View>
      </View>

      {/* İçerik */}
      {count === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.muted} />
          <Muted>{empty}</Muted>
        </View>
      ) : (
        <View style={styles.cardList}>{children}</View>
      )}
    </View>
  );
}

// ── Ana ekran ─────────────────────────────────────────────────────────────

export function AdminRequestsScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const pkgReqs = usePackageRequests();
  const delReqs = useDeletionRequests();
  const pwReqs = usePasswordResetRequests();
  const dismiss = useDismissPackageRequest();
  const approve = useApproveDeletion();
  const reject = useRejectDeletion();
  const handlePwReset = useHandlePasswordResetRequest();
  const router = useRouter();
  const { contentMaxWidth, gutter } = useResponsive();

  function confirm(title: string, msg: string, onYes: () => void) {
    Alert.alert(title, msg, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', onPress: onYes },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Talepler" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        {/* ── Paket Talepleri ──────────────────────────────────────────── */}
        <RequestSection
          icon="cube-outline"
          title="Paket Talepleri"
          count={pkgReqs.data?.length ?? 0}
          accentKey="package"
          empty="Bekleyen paket talebi yok."
        >
          {(pkgReqs.data ?? []).map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.name}>{r.memberName}</Text>
                <View style={[styles.typeBadge, { backgroundColor: 'rgba(124,92,255,0.12)' }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.accent }]}>
                    {r.packageType === 'flexible' ? 'Esnek' : 'Sabit'}
                  </Text>
                </View>
              </View>
              <Text style={styles.sub}>{r.packageName}</Text>
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Paket Tanımla"
                    variant="primary"
                    onPress={() =>
                      router.push({
                        pathname: '/(admin)/members/member-packages',
                        params: { memberId: String(r.memberId), packageId: String(r.packageId) },
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Kaldır"
                    variant="ghost"
                    loading={dismiss.isPending}
                    onPress={() =>
                      confirm('Talebi kaldır', `${r.memberName} için «${r.packageName}» talebi kaldırılsın mı?`, () =>
                        dismiss.mutate(r.id)
                      )
                    }
                  />
                </View>
              </View>
            </View>
          ))}
        </RequestSection>

        {/* ── Şifre Sıfırlama Talepleri ─────────────────────────────── */}
        <RequestSection
          icon="key-outline"
          title="Şifre Sıfırlama Talepleri"
          count={pwReqs.data?.length ?? 0}
          accentKey="password"
          empty="Bekleyen şifre sıfırlama talebi yok."
        >
          {(pwReqs.data ?? []).map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Ionicons name="person-outline" size={15} color={colors.fpOrange} style={{ marginTop: 1 }} />
                <Text style={styles.name}>{r.email}</Text>
              </View>
              <Text style={styles.sub}>
                {new Date(r.createdAt).toLocaleDateString('tr-TR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
              <Button
                title="Şifreyi Sıfırla"
                variant="primary"
                loading={handlePwReset.isPending}
                onPress={() =>
                  confirm(
                    'Şifreyi Sıfırla',
                    `${r.email} kullanıcısının şifresi sıfırlansın mı? Geçici şifre size gösterilecektir.`,
                    () =>
                      handlePwReset.mutate(r.id, {
                        onSuccess: (result) =>
                          Alert.alert(
                            'Şifre Sıfırlandı',
                            `Giriş: ${result.loginEmail}\nGeçici şifre: ${result.temporaryPassword}\n\nÜyeye WhatsApp'tan iletmek için aşağıdaki butonu kullanın. İlk girişte şifre değiştirilecektir.`,
                            [
                              { text: 'Kapat', style: 'cancel' },
                              { text: "📲 WhatsApp'tan Bildir", onPress: () => sendResetWhatsApp(result) },
                            ]
                          ),
                      })
                  )
                }
              />
            </View>
          ))}
        </RequestSection>

        {/* ── Üyelik Silme Talepleri ────────────────────────────────── */}
        <RequestSection
          icon="trash-outline"
          title="Üyelik Silme Talepleri"
          count={delReqs.data?.length ?? 0}
          accentKey="deletion"
          empty="Bekleyen üyelik silme talebi yok."
        >
          {(delReqs.data ?? []).map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Ionicons name="person-remove-outline" size={15} color={colors.danger} style={{ marginTop: 1 }} />
                <Text style={styles.name}>{r.memberName}</Text>
              </View>
              {r.phone ? <Text style={styles.sub}>{r.phone}</Text> : null}
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Onayla (Sil)"
                    variant="danger"
                    loading={approve.isPending}
                    onPress={() =>
                      confirm('Silmeyi onayla', `${r.memberName} üyeliği silinsin mi?`, () => approve.mutate(r.id))
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Reddet"
                    variant="ghost"
                    loading={reject.isPending}
                    onPress={() => reject.mutate(r.id)}
                  />
                </View>
              </View>
            </View>
          ))}
        </RequestSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { paddingVertical: 16, gap: 14, flexGrow: 1 },

    // ── Section box
    section: {
      borderWidth: 1,
      borderRadius: 16,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: surfaceTint(theme, 0.06),
    },
    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    countBadge: {
      minWidth: 28,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    countText: { fontSize: 13, fontWeight: '800' },

    // ── Empty state
    emptyBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },

    // ── Card list
    cardList: { gap: 1 },
    card: {
      backgroundColor: surfaceTint(theme, 0.03),
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: surfaceTint(theme, 0.05),
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    sub: { fontSize: 13, color: colors.muted, marginLeft: 0 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 2 },

    // ── Type badge (paket tipi)
    typeBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    typeBadgeText: { fontSize: 12, fontWeight: '600' },
  });
}
