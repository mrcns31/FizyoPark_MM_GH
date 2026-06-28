import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { formatDayLabel, formatSessionRange, formatTime, weekdayLong, dayOfWeekOfTs } from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../auth';
import { useCancelMemberSession, useMarkBroadcastSeen, useMemberDashboard, useMyBroadcasts } from '../api/hooks';
import type { MemberBroadcast, MemberNotification, MemberSession } from '../api/member-portal';

const TZ = 3 * 3600 * 1000;
function nowIst() { return Date.now(); }

/** Web memberSessionStatusLabel mantığıyla birebir durum tonu. */
function statusTone(s: MemberSession): 'green' | 'orange' | 'neutral' | 'red' | 'accent' {
  if (s.isCancelled) return 'red';
  if (s.isConsumed || s.checkedIn) return 'green';
  if (s.status === 'locked') return 'orange';
  if (s.startTs > nowIst()) return 'accent'; // planlandı
  return 'neutral'; // yapıldı ama onay yok
}

/** Durum etiketi — "Gelmedi" → üye tarafında "Otomatik Düşen Seans" */
function statusLabel(s: MemberSession): string {
  const raw = s.statusLabel || '';
  if (raw === 'Gelmedi' || raw === 'Gelmedi (Onaylanmadı)') return 'Otomatik Düşen Seans';
  if (raw) return raw;
  if (s.isCancelled) return 'İptal edildi';
  if (s.checkedIn) return 'Giriş yapıldı';
  if (s.isConsumed) return 'Yapıldı';
  if (s.startTs > nowIst()) return s.canCancel ? 'Planlandı' : 'İptal edilemez';
  return 'Yapıldı';
}

/** Üye ana ekranı — web renderMemberHome paritesi. */
export function MemberHomeScreen() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useMemberDashboard();
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const cancelMutation = useCancelMemberSession();
  const { contentMaxWidth, gutter } = useResponsive();
  const [cancelTarget, setCancelTarget] = useState<MemberSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [wantReschedule, setWantReschedule] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const allSessions = data?.activePackage?.sessions ?? [];

  // Okunmamış broadcast bildirimi modal
  const { data: broadcasts } = useMyBroadcasts();
  const markSeen = useMarkBroadcastSeen();
  const [notifModal, setNotifModal] = useState<MemberBroadcast | null>(null);
  const shownRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!broadcasts?.length) return;
    const unseen = broadcasts.find((b) => !b.seenAt && !shownRef.current.has(b.id));
    if (unseen) {
      shownRef.current.add(unseen.id);
      setNotifModal(unseen);
    }
  }, [broadcasts]);

  const sessions = useMemo(
    () => allSessions.filter((s) => !s.isCancelled).sort((a, b) => a.startTs - b.startTs),
    [allSessions],
  );

  function openCancel(s: MemberSession) {
    setCancelTarget(s);
    setCancelReason('');
    setWantReschedule(false);
    setCancelError(null);
  }

  async function confirmCancel() {
    const s = cancelTarget;
    if (!s) return;
    setCancelError(null);
    try {
      const result = await cancelMutation.mutateAsync({
        sessionId: s.id,
        body: { reason: cancelReason.trim(), requestNewAppointment: wantReschedule },
      }) as { replenished?: boolean; replenishedReason?: string } | null;
      setCancelTarget(null);
      await refetch();
      const wa = (data?.contactWhatsApp || '').replace(/\D/g, '');
      if (wantReschedule && wa) {
        const msg = `Merhaba, ${formatDayLabel(s.startTs)} ${formatTime(s.startTs)} seansımı iptal ettim, yeni randevu talep ediyorum.${cancelReason.trim() ? ` Sebep: ${cancelReason.trim()}` : ''}`;
        Linking.openURL(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`).catch(() => {});
      }
      if (result?.replenished === false && result?.replenishedReason === 'no_available_slot') {
        Alert.alert('Bilgi', 'Seans iptal edildi ancak paket bitiş tarihine kadar uygun yeni seans bulunamadı.');
      }
    } catch (e) {
      setCancelError((e as Error).message || 'İptal başarısız');
    }
  }

  // Ekrana her dönüşte (admin değişikliği dahil) anında yenile
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const ap = data?.activePackage;
  const wide = { width: '100%' as const, maxWidth: contentMaxWidth, alignSelf: 'center' as const };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* SABİT ÜST */}
      <View style={[styles.fixed, wide, { paddingHorizontal: gutter }]}>
        <Text style={styles.hello} numberOfLines={1}>
          Merhaba{user?.fullName ? `, ${user.fullName}` : ''} 👋
        </Text>

        {error ? <Text style={styles.error}>{(error as Error).message}</Text> : null}

        {data?.notifications?.map((n: MemberNotification, i) => (
          <Card key={i} style={styles.notif}>
            <Text style={styles.notifText}>{n.message}</Text>
          </Card>
        ))}

        {ap ? (
          <View style={styles.pkgCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.pkgName} numberOfLines={1}>{ap.packageName}</Text>
              <Badge label={ap.packageType === 'flexible' ? 'Esnek' : 'Sabit'} tone="accent" />
            </View>
            <View style={styles.statsRow}>
              <Stat value={ap.usedSessions} label="Kullanılan" />
              <Stat value={ap.remainingSessions} label="Kalan" tone="green" />
              <Stat value={ap.lessonCount} label="Toplam" />
            </View>
            <Muted>{ap.startDate} → {ap.endDate}</Muted>
          </View>
        ) : data && !isLoading ? (
          <Card>
            <SectionTitle>Aktif paket yok</SectionTitle>
            <Muted>
              {data.pendingPackageRequest
                ? `«${data.pendingPackageRequest.packageName}» talebiniz onay bekliyor.`
                : 'Profil sekmesinden yeni paket talep edebilirsiniz.'}
            </Muted>
          </Card>
        ) : null}

        {ap ? (
          <Text style={styles.sectionLabel}>Randevularım ({sessions.length})</Text>
        ) : null}
      </View>

      {/* SEANS LİSTESİ */}
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : ap ? (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          refreshing={manualRefreshing}
          onRefresh={async () => { setManualRefreshing(true); try { await refetch(); } finally { setManualRefreshing(false); } }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, wide, { paddingHorizontal: gutter }]}
          ListEmptyComponent={
            <Card><Muted>Randevu bulunmuyor.</Muted></Card>
          }
          renderItem={({ item: s, index }) => {
            const now = nowIst();
            const isPast = s.startTs < now;
            const lbl = statusLabel(s);
            const tone = statusTone(s);
            const dayName = weekdayLong(dayOfWeekOfTs(s.startTs));
            // Gelecek seans ama iptal edilemez → "İptal edilemez" buton pozisyonunda
            const showLocked = !s.isCancelled && !s.isConsumed && !isPast && !s.canCancel;
            return (
              <View style={[styles.sessionCard, isPast && styles.sessionCardPast]}>
                {/* Satır 1: No + Tarih / Saat · Gün | İptal veya İptal Edilemez */}
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.seqNo, isPast && styles.seqNoPast]}>{index + 1}.</Text>
                    <View>
                      <Text style={[styles.dateText, isPast && styles.dateTextPast]}>
                        {formatDayLabel(s.startTs)} / {formatTime(s.startTs)}
                      </Text>
                      <Text style={styles.dayName}>{dayName}</Text>
                    </View>
                  </View>
                  {s.canCancel ? (
                    <Pressable onPress={() => openCancel(s)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>İptal</Text>
                    </Pressable>
                  ) : showLocked ? (
                    <View style={styles.lockedBtn}>
                      <Text style={styles.lockedBtnText}>İptal edilemez</Text>
                    </View>
                  ) : null}
                </View>
                {/* Satır 2: Durum (sadece tamamlanmış/iptal/otomatik düşen için) */}
                {(isPast || s.isCancelled) ? (
                  <View style={styles.badgeRow}>
                    <Badge label={lbl} tone={tone} />
                  </View>
                ) : null}
                {showLocked ? (
                  <Text style={styles.lockedInfo}>Randevular 2 saat kala iptal edilebilmektedir.</Text>
                ) : null}
              </View>
            );
          }}
        />
      ) : null}

      {/* BROADCAST BİLDİRİM MODAL */}
      <Modal visible={!!notifModal} transparent animationType="fade" onRequestClose={() => setNotifModal(null)}>
        <View style={styles.notifOverlay}>
          <View style={styles.notifModal}>
            <Text style={styles.notifModalTitle}>{notifModal?.title}</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.notifModalBody}>{notifModal?.body}</Text>
            </ScrollView>
            <Pressable
              style={styles.notifCloseBtn}
              onPress={() => {
                if (notifModal) markSeen.mutate(notifModal.id);
                setNotifModal(null);
              }}
            >
              <Text style={styles.notifCloseBtnText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* İPTAL SHEET */}
      <BottomSheet
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Seansı iptal et"
      >
        {cancelTarget ? (
          <View style={styles.cancelSheet}>
            <Text style={styles.cancelSheetDate}>
              {formatDayLabel(cancelTarget.startTs)} / {formatTime(cancelTarget.startTs)}
            </Text>
            {ap?.packageType === 'flexible' ? (
              <Text style={styles.flexibleInfo}>Randevular seans saatine 2 saat kala iptal edilebilmektedir.</Text>
            ) : null}
            <Text style={styles.cancelLabel}>İptal sebebi (opsiyonel)</Text>
            <TextInput
              style={styles.cancelInput}
              value={cancelReason}
              onChangeText={(t) => setCancelReason(t.slice(0, 300))}
              placeholder="Kısaca belirtebilirsiniz"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
            />
            <Pressable style={styles.rescheduleRow} onPress={() => setWantReschedule((v) => !v)} hitSlop={6}>
              <View style={[styles.check, wantReschedule && styles.checkOn]}>
                {wantReschedule ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
              </View>
              <Text style={styles.rescheduleText}>Yeni randevu talep etmek istiyorum</Text>
            </Pressable>
            {cancelError ? (
              <Text style={styles.cancelErrorText}>{cancelError}</Text>
            ) : null}
            <Button
              title="Seansı iptal et"
              variant="danger"
              onPress={confirmCancel}
              loading={cancelMutation.isPending}
            />
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'green' }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'green' && { color: colors.ok }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fixed: { paddingTop: 8, paddingBottom: 8, gap: 12 },
  hello: { fontSize: 20, fontWeight: '800', color: colors.text },
  error: { color: colors.danger },
  notif: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: 'rgba(255,149,0,0.3)' },
  notifText: { color: '#FFD9A0', fontSize: 14 },

  pkgCard: {
    backgroundColor: colors.panel,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: colors.radius, padding: 10, gap: 4,
  },
  pkgName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, marginRight: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, backgroundColor: colors.panel2,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 6, alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 1 },

  sectionLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.text },

  list: { paddingTop: 8, paddingBottom: 24, gap: 8 },

  sessionCard: {
    padding: 12, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.panel, gap: 6,
  },
  sessionCardPast: { opacity: 0.6 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flex: 1 },
  seqNo: { color: colors.muted, fontSize: 13, fontWeight: '700', minWidth: 22, paddingTop: 2 },
  seqNoPast: { color: 'rgba(232,236,255,0.3)' },
  dateText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dateTextPast: { color: colors.muted },
  dayName: { fontSize: 11, color: colors.muted, marginTop: 1 },

  cancelBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.5)',
    backgroundColor: 'rgba(255,77,109,0.1)',
    marginLeft: 8,
  },
  cancelBtnText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  lockedBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.4)',
    backgroundColor: 'rgba(255,149,0,0.08)',
    marginLeft: 8,
  },
  lockedBtnText: { color: colors.fpOrange, fontSize: 11, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cancelReasonText: { color: colors.muted, fontSize: 12, flex: 1 },

  notifOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  notifModal: {
    backgroundColor: '#1a1a2e', borderRadius: 18,
    padding: 24, width: '100%', maxWidth: 420, gap: 14,
    borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)',
  },
  notifModalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  notifModalBody: { fontSize: 15, color: 'rgba(232,236,255,0.85)', lineHeight: 22 },
  notifCloseBtn: {
    marginTop: 4, paddingVertical: 13, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  notifCloseBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  lockedInfo: { color: colors.muted, fontSize: 11, marginTop: 2 },
  flexibleInfo: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  cancelErrorText: { color: colors.danger, fontSize: 13 },
  cancelSheet: { gap: 12 },
  cancelSheetDate: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cancelLabel: { color: colors.muted, fontSize: 12 },
  cancelInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 76, textAlignVertical: 'top',
    color: colors.text, fontSize: 16,
  },
  rescheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rescheduleText: { flex: 1, color: colors.text, fontSize: 14 },
});
