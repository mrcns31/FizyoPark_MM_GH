import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { SelectField } from '../../../components/select-field';
import { DateField } from '../../../components/date-field';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { ACTION_LABELS, actionLabel } from '../api/activity-logs';
import { useActivityLogs } from '../api/hooks';

const logDateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function fmtDateTime(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return logDateFmt.format(d);
}

/** İşlem Logları — sistem aktivite kayıtları (web activity-logs.html). Sayfalı liste. */
export function ActivityLogsScreen() {
  const router = useRouter();
  const { contentMaxWidth, gutter } = useResponsive();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filter = useMemo(
    () => ({ action: action ?? undefined, from: from || undefined, to: to || undefined }),
    [action, from, to],
  );
  const { data, isLoading } = useActivityLogs(page, filter);

  const actionOptions = useMemo(
    () => Object.entries(ACTION_LABELS).map(([value, label]) => ({ label, value })),
    [],
  );
  const filterActive = !!action || !!from || !!to;
  function resetPageAnd(fn: () => void) {
    fn();
    setPage(1);
  }

  const totalPages = data?.totalPages ?? 1;

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="İşlem Logları" onBack={() => router.push('/(admin)/more/settings')} />
      <View style={[styles.filters, wide]}>
        <SelectField<string>
          label=""
          placeholder="Tüm işlemler"
          value={action}
          onChange={(v) => resetPageAnd(() => setAction(v))}
          options={actionOptions}
        />
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <DateField value={from} onChange={(v) => resetPageAnd(() => setFrom(v))} placeholder="Başlangıç" />
          </View>
          <View style={styles.dateCol}>
            <DateField value={to} onChange={(v) => resetPageAnd(() => setTo(v))} placeholder="Bitiş" />
          </View>
        </View>
        {filterActive ? (
          <Pressable onPress={() => resetPageAnd(() => { setAction(null); setFrom(''); setTo(''); })} hitSlop={6}>
            <Text style={styles.clear}>Filtreleri temizle</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={[styles.list, wide]} showsVerticalScrollIndicator={false}>
        {(data?.items ?? []).length === 0 && !isLoading ? (
          <Card>
            <Muted>Kayıt yok.</Muted>
          </Card>
        ) : null}
        {(data?.items ?? []).map((l) => (
          <View key={l.id} style={styles.item}>
            <View style={styles.head}>
              <Text style={styles.action}>{actionLabel(l.action)}</Text>
              <Text style={styles.date}>{fmtDateTime(l.createdAt)}</Text>
            </View>
            <Text style={styles.actor}>{l.actorDisplay}</Text>
            {l.entityDisplay ? <Text style={styles.meta}>{l.entityDisplay}</Text> : null}
            {l.detailsDisplay ? <Text style={styles.meta}>{l.detailsDisplay}</Text> : null}
          </View>
        ))}

        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Pressable
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Text style={styles.pageBtnText}>Önceki</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Sayfa {data?.page ?? page} / {totalPages}
            </Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.pageBtnText}>Sonraki</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingTop: 6, paddingBottom: 4, gap: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateCol: { flex: 1 },
  clear: { color: colors.accent, fontSize: 13, fontWeight: '700', alignSelf: 'flex-start' },
  list: { paddingVertical: 12, gap: 8, flexGrow: 1 },
  item: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 3,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  action: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  date: { color: colors.muted, fontSize: 11 },
  actor: { color: 'rgba(232,236,255,0.88)', fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 10 },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  pageInfo: { color: colors.muted, fontSize: 13 },
});
