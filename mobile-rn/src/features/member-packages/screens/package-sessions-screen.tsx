import { useCallback, useRef, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Badge, Card, Muted } from '../../../components/ui';
import { formatTime } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import { useMemberPackageSessions } from '../api/hooks';
import type { MemberPackageSession } from '../api/member-packages';
import { useDeleteSession } from '../../sessions/api/hooks';
import { isAttendanceConfirmed } from '../../sessions/api/sessions';
import { promptAdminPassword } from '../../../lib/admin-password';

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}


/**
 * Web buildPackageSessionApprovalInfo mantığıyla birebir eşleşen badge.
 * approvalLabel backend'den geliyorsa direkt kullanılır.
 */
function badgeFor(s: {
  isCancelled: boolean;
  approvalLabel: string | null;
  approvalKind: string | null;
  checkedInAt: string | null;
  status: string;
}): { label: string; tone: 'green' | 'red' | 'orange' | 'neutral' | 'accent' } {
  if (s.isCancelled) return { label: 'İptal edildi', tone: 'red' };

  const lbl = s.approvalLabel;
  const kind = s.approvalKind;

  if (!lbl || !kind) {
    // Fallback: approvalLabel gelmemişse basit durum
    return { label: 'Planlandı', tone: 'accent' };
  }

  switch (kind) {
    case 'phone':
    case 'card':
    case 'qr': {
      // "Kart - Geldi" → "Kart - 07:59" şeklinde gerçek saati göster
      const time = s.checkedInAt ? formatTime(new Date(s.checkedInAt).getTime()) : null;
      const displayLabel = time ? `${lbl.replace(' - Geldi', '')} - ${time}` : lbl;
      return { label: displayLabel, tone: 'green' };
    }
    case 'admin_present':
    case 'staff_present':
    case 'present':
      return { label: lbl, tone: 'green' };
    case 'no_show':
      return { label: lbl, tone: 'red' };
    case 'burned':
      return { label: lbl, tone: 'red' }; // "Otomatik Düşen Seans"
    case 'pending':
      return { label: lbl, tone: 'orange' }; // "Onaylanmadı"
    case 'scheduled':
      return { label: lbl, tone: 'accent' }; // "Planlandı"
    default:
      return { label: lbl, tone: 'neutral' };
  }
}

const PHYSICAL = ['qr', 'phone', 'card'];

const sessionDateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const sessionWeekdayFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  weekday: 'long',
});
function fmtSessionDate(ts: number): string {
  const d = new Date(ts);
  const datePart = sessionDateFmt.format(d);
  const h = String(d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false })).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} - ${h}:${m}`;
}
function fmtWeekday(ts: number): string {
  return sessionWeekdayFmt.format(new Date(ts));
}

function SessionCard({
  s,
  idx,
  onEdit,
  onDelete,
}: {
  s: MemberPackageSession;
  idx: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const b = badgeFor({ ...s });

  const rightActions = () => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => { swipeRef.current?.close(); onDelete(); }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  const leftActions = () => (
    <TouchableOpacity
      style={styles.swipeEdit}
      onPress={() => { swipeRef.current?.close(); onEdit(); }}
    >
      <Ionicons name="create-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={rightActions}
      renderLeftActions={leftActions}
      overshootLeft={false}
      overshootRight={false}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.idx}>{idx + 1}.</Text>
          <View style={styles.info}>
            <Text style={styles.date}>{fmtSessionDate(s.startTs)}</Text>
            <Text style={styles.sub}>{fmtWeekday(s.startTs)}{s.staffName ? ` - ${s.staffName}` : ''}</Text>
            {s.note ? <Muted>{s.note}</Muted> : null}
          </View>
          <Badge label={b.label} tone={b.tone} />
        </View>
      </View>
    </Swipeable>
  );
}

export function PackageSessionsScreen() {
  const { memberPackageId, packageName, startDate, endDate, packageStatus } = useLocalSearchParams<{
    memberPackageId?: string;
    packageName?: string;
    startDate?: string;
    endDate?: string;
    packageStatus?: string;
  }>();
  const id = memberPackageId ? Number(memberPackageId) : undefined;
  const { data, isLoading } = useMemberPackageSessions(id);
  const router = useRouter();
  const del = useDeleteSession();
  const qc = useQueryClient();

  // Form'dan geri dönüşte seansları yenile
  useFocusEffect(
    useCallback(() => {
      if (id != null) {
        qc.invalidateQueries({ queryKey: ['member-package-sessions', id] });
      }
    }, [qc, id]),
  );

  const sessions = useMemo(() => (data ?? []).slice().sort((a, b) => a.startTs - b.startTs), [data]);
  const active = sessions.filter((s) => !s.isCancelled);
  const cancelled = sessions.filter((s) => s.isCancelled);

  const statusStr = packageStatus === 'active' ? 'Aktif' : packageStatus === 'completed' ? 'Tamamlandı' : packageStatus === 'cancelled' ? 'İptal' : null;

  function goEdit(s: MemberPackageSession) {
    router.push({
      pathname: '/(admin)/members/session-form',
      params: { id: String(s.id), date: new Date(s.startTs).toISOString().slice(0, 10), singleEdit: '1' },
    });
  }

  async function onDelete(s: MemberPackageSession) {
    Alert.alert('Seansı sil', `${fmtSessionDate(s.startTs)} seansı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            let adminPassword: string | undefined;
            // Giriş yapılmış / onaylanmış seanslar için admin şifresi
            const fakeSession = { startTs: s.startTs, checkedInAt: s.checkedInAt, attendanceConfirmedAt: null, staffId: null, memberId: null, endTs: 0, memberName: '', staffName: '', roomId: null, roomName: '', note: '', attendanceOutcome: null, isGroup: false } as any;
            if (isAttendanceConfirmed(fakeSession)) {
              const pwd = await promptAdminPassword('Girişi onaylanmış seansı silmek için admin şifrenizi girin.');
              if (pwd == null) return;
              adminPassword = pwd;
            }
            del.mutate({ id: s.id, adminPassword }, {
              onError: (e) => Alert.alert('Hata', (e as Error).message),
            });
          } catch (e) {
            Alert.alert('Hata', (e as Error).message);
          }
        },
      },
    ]);
  }

  type ListItem =
    | { type: 'header' }
    | { type: 'active'; s: MemberPackageSession; idx: number }
    | { type: 'cancelledHeader' }
    | { type: 'cancelled'; s: MemberPackageSession };

  const listItems: ListItem[] = [
    { type: 'header' },
    ...active.map((s, idx) => ({ type: 'active' as const, s, idx })),
    ...(cancelled.length > 0 ? [{ type: 'cancelledHeader' as const }] : []),
    ...cancelled.map((s) => ({ type: 'cancelled' as const, s })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ title: packageName || 'Paket Seansları' }} />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item, i) =>
            item.type === 'active' ? `a-${item.s.id}` :
            item.type === 'cancelled' ? `c-${item.s.id}` :
            `${item.type}-${i}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (startDate || endDate || statusStr) ? (
                <View style={styles.subtitle}>
                  {startDate && endDate ? (
                    <Text style={styles.subtitleText}>{fmtDate(startDate)} – {fmtDate(endDate)}</Text>
                  ) : null}
                  {statusStr ? <Badge label={statusStr} tone={packageStatus === 'active' ? 'green' : packageStatus === 'cancelled' ? 'red' : 'neutral'} /> : null}
                  <Text style={styles.subtitleText}>{active.length} randevu</Text>
                </View>
              ) : null;
            }
            if (item.type === 'active') {
              return (
                <SessionCard
                  s={item.s}
                  idx={item.idx}
                  onEdit={() => goEdit(item.s)}
                  onDelete={() => onDelete(item.s)}
                />
              );
            }
            if (item.type === 'cancelledHeader') {
              return <Text style={styles.section}>İptal edilen seanslar ({cancelled.length})</Text>;
            }
            if (item.type === 'cancelled') {
              const b = badgeFor({ ...item.s });
              return (
                <Card style={styles.cardCancelled}>
                  <View style={styles.row}>
                    <View style={styles.info}>
                      <Text style={styles.date}>{fmtSessionDate(item.s.startTs)}</Text>
                      <Text style={styles.sub}>{fmtWeekday(item.s.startTs)}{item.s.staffName ? ` - ${item.s.staffName}` : ''}</Text>
                    </View>
                    <Badge label={b.label} tone={b.tone} />
                  </View>
                </Card>
              );
            }
            return null;
          }}
          ListEmptyComponent={<Card><Muted>Bu pakete ait seans yok.</Muted></Card>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 12, gap: 8, paddingBottom: 40 },
  subtitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  subtitleText: { color: colors.muted, fontSize: 13 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  cardCancelled: { padding: 12, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idx: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 24 },
  info: { flex: 1, gap: 2 },
  date: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 2, letterSpacing: 0.5 },
  swipeEdit: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: 12,
    marginRight: 4,
  },
  swipeDelete: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
    borderRadius: 12,
    marginLeft: 4,
  },
});
