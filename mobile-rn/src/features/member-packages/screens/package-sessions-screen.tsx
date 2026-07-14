import { useCallback, useRef, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Badge, Card, Muted } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { formatTime } from '../../../lib/datetime';
import { useTheme } from '../../theme';
import { type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useMemberPackageSessions, useMemberPackages } from '../api/hooks';
import type { MemberPackageSession } from '../api/member-packages';
import { useDeleteSession, useMoveSession } from '../../sessions/api/hooks';
import { promptAdminPassword } from '../../../lib/admin-password';
import type { MemberPackage } from '../../../types/api';

// Backend requireAdminPasswordIfSessionConfirmed ile paralel: bu approvalKind'lerde
// seansa giriş/onay kaydı var, silme/taşıma admin şifresi ister. approvalKind
// backend'de gerçek attendance_confirmed_at kullanılarak hesaplanıyor; bu yüzden
// checkedInAt/checkInMethod'dan PlannerSession taklit edip yeniden hesaplamak yerine
// doğrudan buna güveniyoruz (aksi halde "Gelmedi" seanslarında şifre sorulmadan
// backend'den "Admin şifresi gerekli" hatası dönerdi).
const CONFIRMED_APPROVAL_KINDS = new Set([
  'phone', 'card', 'qr', 'no_show', 'admin_present', 'staff_present', 'present',
]);
function needsAdminPassword(s: MemberPackageSession): boolean {
  return !!s.approvalKind && CONFIRMED_APPROVAL_KINDS.has(s.approvalKind);
}

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

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

  if (!lbl || !kind) return { label: 'Planlandı', tone: 'accent' };

  switch (kind) {
    case 'phone':
    case 'card':
    case 'qr': {
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
      return { label: lbl, tone: 'red' };
    case 'pending':
      return { label: lbl, tone: 'orange' };
    case 'scheduled':
      return { label: lbl, tone: 'accent' };
    default:
      return { label: lbl, tone: 'neutral' };
  }
}

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
  onMove,
}: {
  s: MemberPackageSession;
  idx: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const swipeRef = useRef<Swipeable>(null);
  const b = badgeFor({ ...s });

  const rightActions = () => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => { swipeRef.current?.close(); onDelete(); }}
    >
      <Ionicons name="trash-outline" size={22} color={colors.white} />
    </TouchableOpacity>
  );

  const leftActions = () => (
    <View style={styles.swipeLeftGroup}>
      <TouchableOpacity
        style={styles.swipeEdit}
        onPress={() => { swipeRef.current?.close(); onEdit(); }}
      >
        <Ionicons name="create-outline" size={22} color={colors.white} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.swipeMove}
        onPress={() => { swipeRef.current?.close(); onMove(); }}
      >
        <Ionicons name="swap-horizontal-outline" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
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
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { memberPackageId, packageName, startDate, endDate, packageStatus, memberId: memberIdParam } = useLocalSearchParams<{
    memberPackageId?: string;
    packageName?: string;
    startDate?: string;
    endDate?: string;
    packageStatus?: string;
    memberId?: string;
  }>();
  const id = memberPackageId ? Number(memberPackageId) : undefined;
  const memberId = memberIdParam ? Number(memberIdParam) : undefined;

  const { data, isLoading } = useMemberPackageSessions(id);
  const { data: allPackages } = useMemberPackages(memberId);
  const router = useRouter();
  const del = useDeleteSession();
  const move = useMoveSession();
  const qc = useQueryClient();

  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MemberPackageSession | null>(null);

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

  // Diğer paketler: mevcut paketin dışındakiler (active/completed)
  const otherPackages = useMemo(
    () => (allPackages ?? []).filter((p) => p.id !== id && p.status !== 'cancelled'),
    [allPackages, id],
  );

  const statusStr = packageStatus === 'active' ? 'Aktif' : packageStatus === 'completed' ? 'Tamamlandı' : packageStatus === 'cancelled' ? 'İptal' : null;

  async function onShare() {
    const title = packageName || 'Paket Seansları';
    const period = startDate && endDate ? `${fmtDate(startDate)} – ${fmtDate(endDate)}` : '';

    const rows = active.map((s, i) => {
      const b = badgeFor({ ...s });
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${fmtSessionDate(s.startTs)}</td>
          <td>${s.staffName || '—'}</td>
          <td>${b.label}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
  h2 { margin: 0 0 4px; font-size: 16px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #444; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
  tr:nth-child(even) td { background: #f5f5f5; }
</style></head><body>
<h2>${title}</h2>
<div class="meta">${period ? period + ' &nbsp;·&nbsp; ' : ''}${active.length} randevu</div>
<table>
  <thead><tr><th>#</th><th>Tarih / Saat</th><th>Personel</th><th>Durum</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${title} — PDF` });
      } else {
        Alert.alert('Paylaşım desteklenmiyor', 'Bu cihazda PDF paylaşımı kullanılamıyor.');
      }
    } catch (e) {
      Alert.alert('Hata', (e as Error).message || 'PDF oluşturulamadı.');
    }
  }

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
            if (needsAdminPassword(s)) {
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

  async function onMoveConfirm(targetPkg: MemberPackage) {
    const s = moveTarget;
    if (!s) return;
    setMoveTarget(null);
    try {
      let adminPassword: string | undefined;
      if (needsAdminPassword(s)) {
        const pwd = await promptAdminPassword('Girişi onaylanmış seansı taşımak için admin şifrenizi girin.');
        if (pwd == null) return;
        adminPassword = pwd;
      }
      move.mutate(
        { id: s.id, targetMpId: targetPkg.id, adminPassword },
        { onError: (e) => Alert.alert('Hata', (e as Error).message) },
      );
    } catch (e) {
      Alert.alert('Hata', (e as Error).message);
    }
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
    ...(cancelledOpen ? cancelled.map((s) => ({ type: 'cancelled' as const, s })) : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: packageName || 'Paket Seansları',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 }}>
              {memberPackageId && memberIdParam ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/members/session-form',
                      params: {
                        forceMemberId: memberIdParam,
                        forceMemberPackageId: memberPackageId,
                        defaultTs: String(Date.now()),
                      },
                    })
                  }
                >
                  <Ionicons name="add-circle-outline" size={26} color={colors.accent} />
                </Pressable>
              ) : null}
              <Pressable onPress={onShare} hitSlop={8}>
                <Ionicons name="share-outline" size={24} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />
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
                  onMove={() => setMoveTarget(item.s)}
                />
              );
            }
            if (item.type === 'cancelledHeader') {
              return (
                <Pressable style={styles.cancelledHeader} onPress={() => setCancelledOpen((v) => !v)}>
                  <Text style={styles.section}>İptal edilen seanslar ({cancelled.length})</Text>
                  <Ionicons
                    name={cancelledOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
              );
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

      {/* PAKETE TAŞI SHEET */}
      <BottomSheet
        visible={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title="Pakete taşı"
      >
        {moveTarget ? (
          <View style={styles.moveSheet}>
            <Text style={styles.moveSessionDate}>{fmtSessionDate(moveTarget.startTs)}</Text>
            {otherPackages.length === 0 ? (
              <Muted>Bu üyenin başka paketi yok.</Muted>
            ) : (
              otherPackages.map((pkg) => (
                <Pressable
                  key={pkg.id}
                  style={styles.pkgRow}
                  onPress={() => onMoveConfirm(pkg)}
                >
                  <View style={styles.pkgInfo}>
                    <Text style={styles.pkgName}>{pkg.packageName}</Text>
                    <Text style={styles.pkgMeta}>{fmtDate(pkg.startDate)} – {fmtDate(pkg.endDate)}</Text>
                  </View>
                  <Badge
                    label={pkg.status === 'active' ? 'Aktif' : pkg.status === 'completed' ? 'Tamamlandı' : pkg.status}
                    tone={pkg.status === 'active' ? 'green' : 'neutral'}
                  />
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
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

    cancelledHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      marginBottom: 2,
      paddingVertical: 4,
    },
    section: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

    swipeLeftGroup: { flexDirection: 'row', gap: 4, marginRight: 4 },
    swipeEdit: {
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      width: 60,
      borderRadius: 12,
    },
    swipeMove: {
      backgroundColor: colors.fpOrange,
      justifyContent: 'center',
      alignItems: 'center',
      width: 60,
      borderRadius: 12,
    },
    swipeDelete: {
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 64,
      borderRadius: 12,
      marginLeft: 4,
    },

    moveSheet: { gap: 10 },
    moveSessionDate: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 },
    pkgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
      gap: 10,
    },
    pkgInfo: { flex: 1, gap: 2 },
    pkgName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    pkgMeta: { color: colors.muted, fontSize: 12 },
  });
}
