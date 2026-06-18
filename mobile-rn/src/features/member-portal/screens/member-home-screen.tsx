import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { formatDayLabel, formatSessionRange } from '../../../lib/datetime';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useAuth } from '../../auth';
import { useCancelMemberSession, useMemberDashboard } from '../api/hooks';
import type { MemberNotification, MemberSession } from '../api/member-portal';
import { SessionStatusBadge } from '../components/session-status';

/** Üye ana ekranı (Seanslar) — üst sabit (selam + paket), Gelecek/Geçmiş sekmeli seans listesi. */
export function MemberHomeScreen() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isRefetching } = useMemberDashboard();
  const cancelMutation = useCancelMemberSession();
  const { contentMaxWidth, gutter } = useResponsive();
  const [cancelTarget, setCancelTarget] = useState<MemberSession | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [wantReschedule, setWantReschedule] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const allSessions = data?.activePackage?.sessions ?? [];
  // Gelecek: kronolojik artan; Geçmiş: en yeni üstte.
  const sessions = useMemo(() => {
    const now = Date.now();
    const list = allSessions.slice();
    if (tab === 'upcoming') return list.filter((s) => s.startTs >= now).sort((a, b) => a.startTs - b.startTs);
    return list.filter((s) => s.startTs < now).sort((a, b) => b.startTs - a.startTs);
  }, [allSessions, tab]);

  function openCancel(s: MemberSession) {
    setCancelTarget(s);
    setCancelReason('');
    setWantReschedule(false);
  }

  async function confirmCancel() {
    const s = cancelTarget;
    if (!s) return;
    try {
      await cancelMutation.mutateAsync({
        sessionId: s.id,
        body: { reason: cancelReason.trim(), requestNewAppointment: wantReschedule },
      });
      setCancelTarget(null);
      await refetch();
      // Yeni randevu istendi + tesis WhatsApp'ı varsa WhatsApp'ı aç (web paritesi).
      const wa = (data?.contactWhatsApp || '').replace(/\D/g, '');
      if (wantReschedule && wa) {
        const msg = `Merhaba, ${formatDayLabel(s.startTs)} ${formatSessionRange(s.startTs, s.endTs)} seansımı iptal ettim, yeni randevu talep ediyorum.${cancelReason.trim() ? ` Sebep: ${cancelReason.trim()}` : ''}`;
        Linking.openURL(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`).catch(() => {});
      }
    } catch (e) {
      Alert.alert('Hata', (e as Error).message);
    }
  }

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
              <Stat value={ap.remainingSessions} label="Kalan" tone="green" />
              <Stat value={ap.usedSessions} label="Kullanılan" />
              <Stat value={ap.totalSessions} label="Toplam" />
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
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, tab === 'upcoming' && styles.tabOn]} onPress={() => setTab('upcoming')}>
              <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextOn]}>Gelecek</Text>
            </Pressable>
            <Pressable style={[styles.tab, tab === 'past' && styles.tabOn]} onPress={() => setTab('past')}>
              <Text style={[styles.tabText, tab === 'past' && styles.tabTextOn]}>Geçmiş</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* KAYDIRILABİLİR SEANS LİSTESİ */}
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : ap ? (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, wide, { paddingHorizontal: gutter }]}
          ListEmptyComponent={
            <Card>
              <Muted>{tab === 'upcoming' ? 'Yaklaşan seans yok.' : 'Geçmiş seans yok.'}</Muted>
            </Card>
          }
          renderItem={({ item: s }) => (
            <Card style={styles.sessionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.day}>{formatDayLabel(s.startTs)}</Text>
                <SessionStatusBadge session={s} />
              </View>
              <Text style={styles.time}>{formatSessionRange(s.startTs, s.endTs)}</Text>
              {s.staffName ? <Muted>{s.staffName}</Muted> : null}
              {s.roomName ? <Muted>{s.roomName}</Muted> : null}
              {s.canCancel ? (
                <Text style={styles.cancel} onPress={() => openCancel(s)}>
                  Seansı iptal et
                </Text>
              ) : s.cancelReason ? (
                <Muted>{s.cancelReason}</Muted>
              ) : null}
            </Card>
          )}
        />
      ) : null}

      <BottomSheet
        visible={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Seansı iptal et"
      >
        {cancelTarget ? (
          <View style={styles.cancelSheet}>
            <Muted>
              {formatDayLabel(cancelTarget.startTs)} · {formatSessionRange(cancelTarget.startTs, cancelTarget.endTs)}
            </Muted>
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
  fixed: { paddingTop: 8, paddingBottom: 8, gap: 16 },
  hello: { fontSize: 20, fontWeight: '800', color: colors.text },
  error: { color: colors.danger },
  notif: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: 'rgba(255,149,0,0.3)' },
  notifText: { color: '#FFD9A0', fontSize: 14 },
  // kompakt paket kartı
  pkgCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: colors.radius,
    padding: 10,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pkgName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, marginRight: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.panel2, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 1 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  tabTextOn: { color: colors.text },
  list: { paddingTop: 8, paddingBottom: 16 },
  sessionCard: { marginBottom: 12 },
  day: { fontSize: 15, fontWeight: '700', color: colors.text },
  time: { fontSize: 18, fontWeight: '800', color: colors.accent },
  cancel: { color: colors.danger, fontWeight: '700', fontSize: 14, marginTop: 6 },
  cancelSheet: { gap: 12 },
  cancelLabel: { color: colors.muted, fontSize: 12 },
  cancelInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 76,
    textAlignVertical: 'top',
    color: colors.text,
    fontSize: 16,
  },
  rescheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rescheduleText: { flex: 1, color: colors.text, fontSize: 14 },
});
