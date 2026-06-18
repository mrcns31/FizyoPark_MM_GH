import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { Badge, Card, Muted } from '../../../components/ui';
import { formatDayLabel, formatSessionRange } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import { useMemberPackageSessions } from '../api/hooks';

/** Bir üye-paketine ait seans listesi (web openPackageSessionsModal paritesi). */
export function PackageSessionsScreen() {
  const { memberPackageId, packageName } = useLocalSearchParams<{ memberPackageId?: string; packageName?: string }>();
  const id = memberPackageId ? Number(memberPackageId) : undefined;
  const { data, isLoading } = useMemberPackageSessions(id);

  const sessions = useMemo(
    () => (data ?? []).slice().sort((a, b) => a.startTs - b.startTs),
    [data],
  );
  const active = sessions.filter((s) => !s.isCancelled);
  const cancelled = sessions.filter((s) => s.isCancelled);

  function badgeFor(outcome: string | null): { label: string; tone: 'green' | 'red' | 'neutral' } {
    if (outcome === 'present') return { label: 'Geldi', tone: 'green' };
    if (outcome === 'no_show') return { label: 'Gelmedi', tone: 'red' };
    return { label: 'Bekliyor', tone: 'neutral' };
  }

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: packageName || 'Paket Seansları' }} />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : sessions.length === 0 ? (
        <Card><Muted>Bu pakete ait seans yok.</Muted></Card>
      ) : (
        <View style={styles.list}>
          {active.map((s, i) => {
            const b = badgeFor(s.attendanceOutcome);
            return (
              <Card key={s.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.idx}>{i + 1}.</Text>
                  <View style={styles.info}>
                    <Text style={styles.date}>{formatDayLabel(s.startTs)} · {formatSessionRange(s.startTs, s.endTs)}</Text>
                    <Muted>{[s.staffName, s.roomName].filter(Boolean).join(' · ') || '–'}</Muted>
                    {s.note ? <Muted>{s.note}</Muted> : null}
                  </View>
                  <Badge label={b.label} tone={b.tone} />
                </View>
              </Card>
            );
          })}

          {cancelled.length ? (
            <>
              <Text style={styles.section}>İptal edilen seanslar</Text>
              {cancelled.map((s) => (
                <Card key={s.id} style={styles.cardCancelled}>
                  <View style={styles.row}>
                    <View style={styles.info}>
                      <Text style={styles.date}>{formatDayLabel(s.startTs)} · {formatSessionRange(s.startTs, s.endTs)}</Text>
                      <Muted>{[s.staffName, s.roomName].filter(Boolean).join(' · ') || '–'}</Muted>
                    </View>
                    <Badge label={s.statusLabel || 'İptal'} tone="red" />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 8 },
  card: { padding: 12 },
  cardCancelled: { padding: 12, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idx: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 24 },
  info: { flex: 1, gap: 2 },
  date: { color: colors.text, fontSize: 14, fontWeight: '700' },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 2, letterSpacing: 0.5 },
});
