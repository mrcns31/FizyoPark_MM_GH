import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { Badge, Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { formatDayLabel, formatSessionRange, formatShortDate, formatTime, weekdayLong, dayOfWeekOfTs } from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useAuth } from '../../auth';
import { useCancelMemberSession, useMarkBroadcastSeen, useMemberDashboard, useMyBroadcasts, useRateMemberSession } from '../api/hooks';
import type { MemberBroadcast, MemberNotification, MemberSession } from '../api/member-portal';
import { StarRating } from '../../../components/star-rating';

/**
 * Puanlama sheet'inin hedefi — hem seans kartından hem bekleyen puan listesinden doldurulur.
 * Puan bir kez verildiği için hedef her zaman puanlanmamış bir seanstır.
 */
type RatingTarget = {
  sessionId: number;
  startTs: number;
  staffName: string;
};

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
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
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

  // Puanlama
  const rateMutation = useRateMemberSession();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingError, setRatingError] = useState<string | null>(null);

  // Toplu puanlama: açılışta puanlanmamış tüm seanslar tek sayfada sorulur
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchValues, setBatchValues] = useState<Record<number, number>>({});
  const [batchComments, setBatchComments] = useState<Record<number, string>>({});
  const [batchCommentOpen, setBatchCommentOpen] = useState<Record<number, boolean>>({});
  const [batchError, setBatchError] = useState<string | null>(null);
  const batchShownRef = useRef(false);

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

  function openRating(t: RatingTarget) {
    setRatingTarget(t);
    setRatingValue(0);
    setRatingComment('');
    setRatingError(null);
  }

  /** Puan geri alınamadığı için gönderimden önce onay istenir. */
  function confirmRating() {
    if (!ratingTarget || ratingValue < 1) return;
    Alert.alert(
      'Puanınızı onaylıyor musunuz?',
      `${ratingValue} yıldız vereceksiniz. Puanınızı daha sonra değiştiremezsiniz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Onayla', onPress: submitRating },
      ],
    );
  }

  async function submitRating() {
    if (!ratingTarget || ratingValue < 1) return;
    setRatingError(null);
    try {
      await rateMutation.mutateAsync({
        sessionId: ratingTarget.sessionId,
        rating: ratingValue,
        comment: ratingComment.trim(),
      });
      setRatingTarget(null);
      await refetch();
    } catch (e) {
      setRatingError((e as Error).message || 'Puan kaydedilemedi');
    }
  }

  const pendingRatings = data?.pendingRatings ?? [];
  const batchRatedCount = Object.values(batchValues).filter((v) => v >= 1).length;

  /**
   * Puanlanmamış seanslar açılışta TEK sayfada sorulur — birikmiş seanslar için
   * arka arkaya sayfa açmak üyeyi puanlamaktan soğutur. Zorunlu değil, kapatılabilir.
   */
  useEffect(() => {
    if (!pendingRatings.length || batchShownRef.current || ratingTarget || notifModal) return;
    batchShownRef.current = true;
    setBatchValues({});
    setBatchComments({});
    setBatchCommentOpen({});
    setBatchError(null);
    setBatchOpen(true);
  }, [pendingRatings.length, ratingTarget, notifModal]);

  function confirmBatch() {
    if (batchRatedCount < 1) return;
    Alert.alert(
      'Puanlarınızı onaylıyor musunuz?',
      `${batchRatedCount} seansı puanlayacaksınız. Puanlarınızı daha sonra değiştiremezsiniz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Onayla', onPress: submitBatch },
      ],
    );
  }

  async function submitBatch() {
    const entries = Object.entries(batchValues).filter(([, v]) => v >= 1);
    if (!entries.length) return;
    setBatchError(null);
    const failed: number[] = [];
    // Sırayla gönderilir: biri hata verirse diğerleri yine de kaydedilir
    for (const [sessionId, rating] of entries) {
      try {
        await rateMutation.mutateAsync({
          sessionId: Number(sessionId),
          rating,
          comment: (batchComments[Number(sessionId)] || '').trim(),
        });
      } catch {
        failed.push(Number(sessionId));
      }
    }
    await refetch();
    if (failed.length) {
      setBatchValues({});
      setBatchError(`${failed.length} seansın puanı kaydedilemedi. Lütfen tekrar deneyin.`);
      return;
    }
    setBatchOpen(false);
  }

  function openCancel(s: MemberSession) {
    setCancelTarget(s);
    setCancelReason('');
    setWantReschedule(false);
    setCancelError(null);
  }

  async function confirmCancel() {
    const s = cancelTarget;
    if (!s) return;
    if (s.checkedIn) return;
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
                    <View style={styles.dateWrap}>
                      <Text
                        style={[styles.dateText, isPast && styles.dateTextPast]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {formatDayLabel(s.startTs)} {dayName} {formatTime(s.startTs)}
                      </Text>
                    </View>
                  </View>
                  {s.canCancel && !s.checkedIn ? (
                    <Pressable onPress={() => openCancel(s)} style={styles.cancelBtn}>
                      <Text style={styles.cancelBtnText}>İptal</Text>
                    </Pressable>
                  ) : showLocked ? (
                    <View style={styles.lockedBtn}>
                      <Text style={styles.lockedBtnText}>İptal edilemez</Text>
                    </View>
                  ) : null}
                </View>
                {/* Satır 2: Durum rozeti + puanlama (yıldızlar aynı satırda, sağa yaslı) */}
                {(isPast || s.isCancelled || s.checkedIn) ? (
                  <View style={styles.badgeRow}>
                    <Badge label={lbl} tone={tone} />
                    {s.canRate || s.rating != null ? (
                      <Pressable
                        style={styles.ratingInline}
                        onPress={() => s.canRate && openRating({
                          sessionId: s.id,
                          startTs: s.startTs,
                          staffName: s.staffName,
                        })}
                        disabled={!s.canRate}
                        hitSlop={6}
                      >
                        {/* Puan verilmemişse boş yıldızların ne işe yaradığı belli olsun */}
                        {s.rating == null ? (
                          <Text style={styles.ratingHint}>Puanlayın</Text>
                        ) : null}
                        <StarRating value={s.rating} size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {showLocked ? (
                  <Text style={styles.lockedInfo}>
                    {ap?.packageType === 'flexible'
                      ? 'Randevular 2 saat kala iptal edilebilmektedir.'
                      : 'Sabit paketlerde randevu iptali yapılamamaktadır.'}
                  </Text>
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
                {wantReschedule ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
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

      {/* PUANLAMA SHEET */}
      <BottomSheet
        visible={!!ratingTarget}
        onClose={() => setRatingTarget(null)}
        title="Seansınızı puanlayın"
      >
        {ratingTarget ? (
          <View style={styles.cancelSheet}>
            <Text style={styles.cancelSheetDate}>
              {formatDayLabel(ratingTarget.startTs)} / {formatTime(ratingTarget.startTs)}
            </Text>
            {ratingTarget.staffName ? (
              <Muted>{ratingTarget.staffName}</Muted>
            ) : null}

            <View style={styles.ratingStarsBox}>
              <StarRating value={ratingValue} onChange={setRatingValue} size={38} showLabel />
            </View>
            <Text style={styles.ratingOnceInfo}>Puanınızı daha sonra değiştiremezsiniz.</Text>

            <Text style={styles.cancelLabel}>Yorumunuz (opsiyonel)</Text>
            <TextInput
              style={styles.cancelInput}
              value={ratingComment}
              onChangeText={(t) => setRatingComment(t.slice(0, 1000))}
              placeholder="Görüşlerinizi paylaşabilirsiniz"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
            />
            {ratingError ? <Text style={styles.cancelErrorText}>{ratingError}</Text> : null}
            <Button
              title="Puanı gönder"
              onPress={confirmRating}
              disabled={ratingValue < 1}
              loading={rateMutation.isPending}
            />
            <Pressable onPress={() => setRatingTarget(null)} hitSlop={8}>
              <Text style={styles.ratingSkip}>Şimdi değil</Text>
            </Pressable>
          </View>
        ) : null}
      </BottomSheet>

      {/* TOPLU PUANLAMA SHEET — açılışta puanlanmamış tüm seanslar tek sayfada */}
      <BottomSheet
        visible={batchOpen}
        onClose={() => setBatchOpen(false)}
        title={pendingRatings.length > 1 ? 'Seanslarınızı puanlayın' : 'Seansınızı puanlayın'}
      >
        <View style={styles.cancelSheet}>
          <Muted>
            {pendingRatings.length > 1
              ? `Puanlanmayı bekleyen ${pendingRatings.length} seansınız var. Dilediğinizi boş bırakabilirsiniz.`
              : 'Görüşleriniz bizim için değerli.'}
          </Muted>

          {pendingRatings.map((p) => {
            const rated = (batchValues[p.sessionId] ?? 0) >= 1;
            const commentOpen = !!batchCommentOpen[p.sessionId];
            const comment = batchComments[p.sessionId] || '';
            return (
              <View key={p.sessionId} style={styles.batchItem}>
                <View style={styles.batchItemRow}>
                  <View style={styles.batchItemHead}>
                    <Text style={styles.batchItemDate}>
                      {formatShortDate(p.startTs)} / {weekdayLong(dayOfWeekOfTs(p.startTs))} {formatTime(p.startTs)}
                    </Text>
                    {p.staffName ? <Text style={styles.batchItemStaff}>{p.staffName}</Text> : null}
                  </View>
                  <StarRating
                    value={batchValues[p.sessionId] ?? null}
                    onChange={(v) => setBatchValues((prev) => ({ ...prev, [p.sessionId]: v }))}
                    size={30}
                  />
                </View>

                {/* Yorum alanı yalnızca puan verildikten sonra ve istenirse açılır —
                    üç seans için üç kutu birden açık dursaydı sayfa kullanılamaz olurdu */}
                {rated && !commentOpen ? (
                  <Pressable
                    onPress={() => setBatchCommentOpen((prev) => ({ ...prev, [p.sessionId]: true }))}
                    hitSlop={6}
                  >
                    <Text style={styles.batchCommentLink}>
                      {comment ? '✎ Yorumu düzenle' : '+ Yorum ekle (opsiyonel)'}
                    </Text>
                  </Pressable>
                ) : null}

                {rated && commentOpen ? (
                  <TextInput
                    style={styles.batchCommentInput}
                    value={comment}
                    onChangeText={(t) =>
                      setBatchComments((prev) => ({ ...prev, [p.sessionId]: t.slice(0, 1000) }))
                    }
                    placeholder="Bu seansla ilgili görüşleriniz"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={1000}
                    autoFocus
                  />
                ) : null}
              </View>
            );
          })}

          <Text style={styles.ratingOnceInfo}>Puanlarınızı daha sonra değiştiremezsiniz.</Text>
          {batchError ? <Text style={styles.cancelErrorText}>{batchError}</Text> : null}

          <Button
            title={batchRatedCount > 1 ? `${batchRatedCount} puanı gönder` : 'Puanı gönder'}
            onPress={confirmBatch}
            disabled={batchRatedCount < 1}
            loading={rateMutation.isPending}
          />
          <Pressable onPress={() => setBatchOpen(false)} hitSlop={8}>
            <Text style={styles.ratingSkip}>Şimdi değil</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'green' }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone === 'green' && { color: colors.ok }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    fixed: { paddingTop: 8, paddingBottom: 8, gap: 12 },
    hello: { fontSize: 20, fontWeight: '800', color: colors.text },
    error: { color: colors.danger },
    notif: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: 'rgba(255,149,0,0.3)' },
    notifText: { color: colors.notification, fontSize: 14 },

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
      borderColor: colors.border, backgroundColor: surfaceTint(theme, 0.03),
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
    seqNoPast: { color: surfaceTint(theme, 0.3) },
    // Tarih tek satırda: "26 Temmuz 2026 Pazar 10:00" — dar ekranda yazı küçülerek sığar
    dateWrap: { flex: 1 },
    dateText: { fontSize: 14, fontWeight: '700', color: colors.text },
    dateTextPast: { color: colors.muted },

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

    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cancelReasonText: { color: colors.muted, fontSize: 12, flex: 1 },

    notifOverlay: {
      flex: 1, backgroundColor: colors.overlay,
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    notifModal: {
      backgroundColor: colors.modalBg, borderRadius: 18,
      padding: 24, width: '100%', maxWidth: 420, gap: 14,
      borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)',
    },
    notifModalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    notifModalBody: { fontSize: 15, color: surfaceTint(theme, 0.85), lineHeight: 22 },
    notifCloseBtn: {
      marginTop: 4, paddingVertical: 13, borderRadius: 12,
      backgroundColor: colors.accent, alignItems: 'center',
    },
    notifCloseBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
    lockedInfo: { color: colors.muted, fontSize: 11, marginTop: 2 },

    // Durum rozetiyle aynı satırda, sağa yaslı — marginLeft:'auto' rozeti solda tutar
    ratingInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
    },
    ratingHint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    ratingStarsBox: { alignItems: 'center', gap: 6, paddingVertical: 8 },
    batchItem: {
      gap: 8,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: surfaceTint(theme, 0.1),
    },
    batchItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    batchItemHead: { flex: 1, gap: 2 },
    batchItemDate: { color: colors.text, fontSize: 14, fontWeight: '700' },
    batchItemStaff: { color: colors.muted, fontSize: 12 },
    batchCommentLink: { color: colors.accent, fontSize: 12, fontWeight: '600' },
    batchCommentInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: surfaceTint(theme, 0.03),
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    ratingOnceInfo: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: -6 },
    ratingSkip: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 6 },
    flexibleInfo: { color: colors.muted, fontSize: 12, lineHeight: 17 },
    cancelErrorText: { color: colors.danger, fontSize: 13 },
    cancelSheet: { gap: 12 },
    cancelSheetDate: { color: colors.text, fontWeight: '700', fontSize: 15 },
    cancelLabel: { color: colors.muted, fontSize: 12 },
    cancelInput: {
      backgroundColor: surfaceTint(theme, 0.03),
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: 10,
      minHeight: 76, textAlignVertical: 'top',
      color: colors.text, fontSize: 16,
    },
    rescheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    check: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1,
      borderColor: colors.border, backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center', justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    rescheduleText: { flex: 1, color: colors.text, fontSize: 14 },
  });
}
