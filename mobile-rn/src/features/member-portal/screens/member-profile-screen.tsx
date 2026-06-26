import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { ChangePasswordForm } from '../../auth/components/change-password-form';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../auth';
import { useCreatePackageRequest, useMarkBroadcastSeen, useMemberDashboard, useMyBroadcasts, useRequestAccountDeletion } from '../api/hooks';
import type { CatalogPackage, MemberBroadcast } from '../api/member-portal';

const notifDateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
function fmtDate(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : notifDateFmt.format(d);
}

/** Üye profili — bilgiler + Paketler/Şifre Değiştir (bottom sheet) + çıkış. */
export function MemberProfileScreen() {
  const { signOut } = useAuth();
  const { data, refetch } = useMemberDashboard();
  const deletion = useRequestAccountDeletion();
  const requestPkg = useCreatePackageRequest();
  const { contentMaxWidth, gutter } = useResponsive();
  const p = data?.profile;

  const { data: broadcasts } = useMyBroadcasts();
  const markSeen = useMarkBroadcastSeen();

  const [pkgOpen, setPkgOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [notifListOpen, setNotifListOpen] = useState(false);
  const [notifDetail, setNotifDetail] = useState<MemberBroadcast | null>(null);

  const hasActive = !!data?.activePackage;
  const pending = data?.pendingPackageRequest;

  function onRequest(pkg: CatalogPackage) {
    Alert.alert('Paket talebi', `«${pkg.name}» paketini talep etmek istiyor musunuz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Talep et',
        onPress: async () => {
          try {
            await requestPkg.mutateAsync(pkg.id);
            await refetch();
            setPkgOpen(false);
            Alert.alert('Talebiniz alındı', 'Onaylandıktan sonra bilgilendirileceksiniz.');
          } catch (e) {
            Alert.alert('Hata', (e as Error).message);
          }
        },
      },
    ]);
  }

  function onRequestDeletion() {
    Alert.alert('Üyelik iptal talebi', 'Üyeliğinizin iptali için talep oluşturulacak. Devam edilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Talep oluştur',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletion.mutateAsync();
            await refetch();
            Alert.alert('Talebiniz alındı', 'Onaylandıktan sonra bilgilendirileceksiniz.');
          } catch (e) {
            Alert.alert('Hata', (e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profil</Text>

        <Card>
          <Text style={styles.name}>{p?.fullName ?? '—'}</Text>
          {p?.memberNo ? <Muted>Üye No: {p.memberNo}</Muted> : null}
          <Row label="Telefon" value={p?.phone} />
          <Row label="E-posta" value={p?.email} />
          <Row label="Meslek" value={p?.profession} />
        </Card>

        {p?.deletionRequestedAt ? (
          <Card style={styles.warn}>
            <SectionTitle>İptal talebi beklemede</SectionTitle>
            <Muted>Üyelik iptal talebiniz onay bekliyor.</Muted>
          </Card>
        ) : null}

        <NavRow icon="cube-outline" label="Paketlerim" onPress={() => setPkgOpen(true)} />
        <NavRow
          icon="notifications-outline"
          label="Bildirimlerim"
          badge={(broadcasts ?? []).filter((b) => !b.seenAt).length}
          onPress={() => setNotifListOpen(true)}
        />
        <NavRow icon="lock-closed-outline" label="Şifre Değiştir" onPress={() => setPwOpen(true)} />

        <Button title="Çıkış Yap" variant="ghost" onPress={signOut} style={{ marginTop: 6 }} />
        {!p?.deletionRequestedAt ? (
          <Button title="Üyeliğimi iptal et" variant="danger" onPress={onRequestDeletion} loading={deletion.isPending} />
        ) : null}
      </ScrollView>

      {/* Paketler bottom sheet */}
      <BottomSheet visible={pkgOpen} onClose={() => setPkgOpen(false)} title="Paketler">
        {pending ? (
          <Card style={styles.pending}>
            <SectionTitle>Talep onay bekliyor</SectionTitle>
            <Muted>«{pending.packageName}» paketiniz onay bekliyor.</Muted>
          </Card>
        ) : null}

        {!hasActive && !pending ? (
          <>
            <SectionTitle>Paket talep et</SectionTitle>
            {(data?.catalogPackages ?? []).map((pkg) => (
              <Card key={pkg.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.pkgName}>{pkg.name}</Text>
                  <Badge label={pkg.packageType === 'flexible' ? 'Esnek' : 'Sabit'} tone="accent" />
                </View>
                <Muted>{pkg.lessonCount} seans</Muted>
                <Button title="Talep et" onPress={() => onRequest(pkg)} loading={requestPkg.isPending} style={{ marginTop: 6 }} />
              </Card>
            ))}
          </>
        ) : null}

        {hasActive ? (
          <Card>
            <SectionTitle>{data!.activePackage!.packageName}</SectionTitle>
            <Muted>
              {data!.activePackage!.remainingSessions} kalan · {data!.activePackage!.usedSessions}/
              {data!.activePackage!.totalSessions} kullanıldı
            </Muted>
          </Card>
        ) : null}

        {data?.pastPackages?.length ? (
          <>
            <SectionTitle>Geçmiş paketler</SectionTitle>
            {data.pastPackages.map((pkg) => (
              <Card key={pkg.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.pkgName}>{pkg.packageName}</Text>
                  <Badge label={pkg.status === 'cancelled' ? 'İptal' : 'Tamamlandı'} tone={pkg.status === 'cancelled' ? 'red' : 'green'} />
                </View>
                <Muted>{pkg.usedSessions}/{pkg.totalSessions} seans · {pkg.startDate} → {pkg.endDate}</Muted>
              </Card>
            ))}
          </>
        ) : null}
      </BottomSheet>

      {/* Şifre değiştir bottom sheet */}
      <BottomSheet visible={pwOpen} onClose={() => setPwOpen(false)} title="Şifre Değiştir">
        <ChangePasswordForm bare />
      </BottomSheet>

      {/* Bildirimler listesi bottom sheet */}
      <BottomSheet visible={notifListOpen} onClose={() => setNotifListOpen(false)} title="Bildirimlerim">
        {(broadcasts ?? []).length === 0 ? (
          <Card><Muted>Henüz bildirim yok.</Muted></Card>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <View style={styles.notifList}>
              {(broadcasts ?? []).map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.notifItem, !b.seenAt && styles.notifItemUnread]}
                  onPress={() => {
                    setNotifListOpen(false);
                    setNotifDetail(b);
                    if (!b.seenAt) markSeen.mutate(b.id);
                  }}
                >
                  <View style={styles.notifItemHead}>
                    <Text style={styles.notifItemTitle} numberOfLines={1}>{b.title}</Text>
                    {!b.seenAt ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.notifItemBody} numberOfLines={2}>{b.body}</Text>
                  <Text style={styles.notifItemDate}>{fmtDate(b.createdAt)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Bildirim detay modal */}
      <Modal visible={!!notifDetail} transparent animationType="fade" onRequestClose={() => setNotifDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{notifDetail?.title}</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalBody}>{notifDetail?.body}</Text>
            </ScrollView>
            <Text style={styles.modalDate}>{notifDetail ? fmtDate(notifDetail.createdAt) : ''}</Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => setNotifDetail(null)}>
              <Text style={styles.modalCloseBtnText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function NavRow({ icon, label, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={styles.navLabel}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={styles.navBadge}>
          <Text style={styles.navBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: 16, gap: 12, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 2 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  warn: { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.3)' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  navLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pending: { backgroundColor: 'rgba(255,149,0,0.1)', borderColor: 'rgba(255,149,0,0.3)' },
  pkgName: { fontSize: 16, fontWeight: '700', color: colors.text },
  navBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5, marginRight: 4,
  },
  navBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  // Bildirim listesi
  notifList: { gap: 8 },
  notifItem: {
    padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.02)', gap: 4,
  },
  notifItemUnread: {
    borderColor: 'rgba(124,92,255,0.4)',
    backgroundColor: 'rgba(124,92,255,0.06)',
  },
  notifItemHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifItemTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  notifItemBody: { fontSize: 13, color: 'rgba(232,236,255,0.7)', lineHeight: 18 },
  notifItemDate: { fontSize: 11, color: colors.muted },
  // Detay modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a2e', borderRadius: 18, padding: 24,
    width: '100%', maxWidth: 420, gap: 14,
    borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalBody: { fontSize: 15, color: 'rgba(232,236,255,0.85)', lineHeight: 22 },
  modalDate: { fontSize: 12, color: colors.muted },
  modalCloseBtn: {
    marginTop: 4, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  modalCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
