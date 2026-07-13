import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useBroadcasts, useBroadcastRecipients } from '../api/hooks';
import type { Broadcast } from '../api/broadcasts';

const logDateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function fmtDate(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : logDateFmt.format(d);
}

function RecipientList({ broadcastId }: { broadcastId: number }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, isLoading } = useBroadcastRecipients(broadcastId);
  if (isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />;
  if (!data?.length) return <Muted>Alıcı bulunamadı.</Muted>;
  return (
    <View style={styles.recipientList}>
      {data.map((r) => (
        <View key={r.memberId} style={styles.recipientRow}>
          <Ionicons
            name={r.hasToken ? 'checkmark-circle' : 'close-circle'}
            size={14}
            color={r.hasToken ? colors.ok : colors.muted}
          />
          <Text style={[styles.recipientName, !r.hasToken && styles.recipientNoToken]}>
            {r.memberName}
          </Text>
          {!r.hasToken ? <Text style={styles.noTokenLabel}>uygulama yok</Text> : null}
        </View>
      ))}
    </View>
  );
}

function BroadcastCard({ item }: { item: Broadcast }) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View style={styles.cardHead}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardDate}>{fmtDate(item.createdAt)}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.muted}
          />
        </View>
        <Text style={styles.cardBody} numberOfLines={expanded ? undefined : 2}>{item.body}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text style={styles.statText}>{item.totalSelected} seçildi</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={13} color={colors.ok} />
            <Text style={[styles.statText, { color: colors.ok }]}>{item.totalSent} iletildi</Text>
          </View>
          {item.totalNoToken > 0 ? (
            <View style={styles.stat}>
              <Ionicons name="phone-portrait-outline" size={13} color={colors.muted} />
              <Text style={styles.statText}>{item.totalNoToken} ulaşılamadı</Text>
            </View>
          ) : null}
          <Text style={styles.sentBy}>— {item.sentByName}</Text>
        </View>
      </Pressable>

      {expanded ? <RecipientList broadcastId={item.id} /> : null}
    </View>
  );
}

export function BroadcastsScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { contentMaxWidth, gutter } = useResponsive();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBroadcasts(page);

  const wide = {
    paddingHorizontal: gutter,
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
  };
  const totalPages = data?.totalPages ?? 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Bildirim Geçmişi" />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={[styles.list, wide]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Card><Muted>Henüz bildirim gönderilmemiş.</Muted></Card>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Pressable
                  style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => p - 1)}
                >
                  <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.muted : colors.text} />
                  <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextOff]}>Önceki</Text>
                </Pressable>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <Pressable
                  style={[styles.pageBtn, page >= totalPages && styles.pageBtnOff]}
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => p + 1)}
                >
                  <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextOff]}>Sonraki</Text>
                  <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? colors.muted : colors.text} />
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => <BroadcastCard item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    list: { paddingVertical: 12, gap: 10, flexGrow: 1 },
    card: {
      padding: 12, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, backgroundColor: surfaceTint(theme, 0.03), gap: 6,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    cardMeta: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    cardDate: { fontSize: 11, color: colors.muted },
    cardBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 2 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12, color: colors.muted },
    sentBy: { fontSize: 11, color: colors.muted, marginLeft: 'auto' },
    recipientList: { marginTop: 8, gap: 5, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
    recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    recipientName: { fontSize: 13, color: colors.text, flex: 1 },
    recipientNoToken: { color: colors.muted },
    noTokenLabel: { fontSize: 11, color: colors.muted },
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 },
    pageBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: surfaceTint(theme, 0.03),
    },
    pageBtnOff: { opacity: 0.4 },
    pageBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
    pageBtnTextOff: { color: colors.muted },
    pageInfo: { color: colors.muted, fontSize: 13 },
  });
}
