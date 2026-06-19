import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { Badge, Card, Muted } from '../../../components/ui';
import { formatTime } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import { useMemberPackageSessions } from '../api/hooks';

function fmtDate(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function methodLabel(m: string | null): string {
  if (m === 'qr') return 'QR';
  if (m === 'phone') return 'Telefon';
  if (m === 'card') return 'Kart';
  return 'Giriş';
}

/**
 * Web mantığı:
 * - QR/Telefon/Kart → "QR - 09:32"
 * - Personel/Admin onayı geldi → "Arzum - ✓"
 * - Personel/Admin onayı gelmedi → "Arzum - ✗"
 * - Planlandı → "Randevu Oluşturuldu"
 * - İptal edilemez → "İptal Edilemez"
 * - İptal edildi → "İptal edildi"
 */
function badgeFor(s: {
  status: string;
  statusLabel: string | null;
  attendanceOutcome: string | null;
  isCancelled: boolean;
  checkInMethod: string | null;
  checkedInAt: string | null;
  staffName: string;
}): { label: string; tone: 'green' | 'red' | 'orange' | 'neutral' | 'accent' } {
  if (s.isCancelled) {
    return { label: 'İptal edildi', tone: 'red' };
  }
  if (s.status === 'locked') {
    return { label: 'İptal Edilemez', tone: 'orange' };
  }
  // QR / Telefon / Kart ile fiziksel giriş
  if (PHYSICAL.includes(s.checkInMethod ?? '') && s.checkedInAt) {
    const time = formatTime(new Date(s.checkedInAt).getTime());
    return { label: `${methodLabel(s.checkInMethod)} - ${time}`, tone: 'green' };
  }
  // Personel / Admin onayı
  if (s.attendanceOutcome === 'present' || s.status === 'completed') {
    return { label: `${firstName(s.staffName)} - ✓`, tone: 'green' };
  }
  if (s.attendanceOutcome === 'no_show') {
    return { label: `${firstName(s.staffName)} - ✗`, tone: 'red' };
  }
  // Planlandı
  return { label: 'Randevu Oluşturuldu', tone: 'accent' };
}

const PHYSICAL = ['qr', 'phone', 'card'];

/** "12 Mayıs 2026 - 09:00" */
const sessionDateFmt = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
function fmtSessionDate(ts: number): string {
  const d = new Date(ts);
  const datePart = sessionDateFmt.format(d);
  const h = String(d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false })).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} - ${h}:${m}`;
}


/** Bir üye-paketine ait seans listesi — web `openPackageSessionsModal` paritesi. */
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

  const sessions = useMemo(() => (data ?? []).slice().sort((a, b) => a.startTs - b.startTs), [data]);
  const active = sessions.filter((s) => !s.isCancelled);
  const cancelled = sessions.filter((s) => s.isCancelled);

  const statusStr = packageStatus === 'active' ? 'Aktif' : packageStatus === 'completed' ? 'Tamamlandı' : packageStatus === 'cancelled' ? 'İptal' : null;

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: packageName || 'Paket Seansları' }} />

      {/* Alt başlık — web fmtPackageModalSubtitle */}
      {(startDate || endDate || statusStr) ? (
        <View style={styles.subtitle}>
          {startDate && endDate ? (
            <Text style={styles.subtitleText}>{fmtDate(startDate)} – {fmtDate(endDate)}</Text>
          ) : null}
          {statusStr ? <Badge label={statusStr} tone={packageStatus === 'active' ? 'green' : packageStatus === 'cancelled' ? 'red' : 'neutral'} /> : null}
          <Text style={styles.subtitleText}>{active.length} randevu</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : sessions.length === 0 ? (
        <Card><Muted>Bu pakete ait seans yok.</Muted></Card>
      ) : (
        <View style={styles.list}>
          {active.map((s, i) => {
            const b = badgeFor({ ...s });
            return (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/planner/session-form',
                    params: { id: String(s.id), date: new Date(s.startTs).toISOString().slice(0, 10) },
                  })
                }
              >
                <View style={styles.row}>
                  <Text style={styles.idx}>{i + 1}.</Text>
                  <View style={styles.info}>
                    <Text style={styles.date}>{fmtSessionDate(s.startTs)}</Text>
                    {s.staffName ? <Muted>{s.staffName}</Muted> : null}
                    {s.note ? <Muted>{s.note}</Muted> : null}
                  </View>
                  <Badge label={b.label} tone={b.tone} />
                </View>
              </Pressable>
            );
          })}

          {cancelled.length > 0 ? (
            <>
              <Text style={styles.section}>İptal edilen seanslar ({cancelled.length})</Text>
              {cancelled.map((s) => {
                const b = badgeFor({ ...s });
                return (
                  <Card key={s.id} style={styles.cardCancelled}>
                    <View style={styles.row}>
                      <View style={styles.info}>
                        <Text style={styles.date}>{fmtSessionDate(s.startTs)}</Text>
                        {s.staffName ? <Muted>{s.staffName}</Muted> : null}
                      </View>
                      <Badge label={b.label} tone={b.tone} />
                    </View>
                  </Card>
                );
              })}
            </>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 4 },
  subtitleText: { color: colors.muted, fontSize: 13 },
  list: { gap: 8, marginTop: 4 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardPressed: { backgroundColor: 'rgba(124,92,255,0.08)', borderColor: 'rgba(124,92,255,0.3)' },
  cardCancelled: { padding: 12, opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idx: { color: colors.muted, fontSize: 13, fontWeight: '700', width: 24 },
  info: { flex: 1, gap: 2 },
  date: { color: colors.text, fontSize: 14, fontWeight: '700' },
  right: { alignItems: 'flex-end', gap: 4 },
  checkIn: { color: colors.ok, fontSize: 11, fontWeight: '600' },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 2, letterSpacing: 0.5 },
});
