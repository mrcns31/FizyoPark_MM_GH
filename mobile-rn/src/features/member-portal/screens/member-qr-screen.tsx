import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../../components/screen-container';
import { Card, Muted } from '../../../components/ui';
import { colors } from '../../../theme/colors';
import { useMemberAccessQr, useMemberCheckInPoll } from '../api/hooks';

/** Tesis giriş QR kodu — token süreli, otomatik yenilenir + check-in canlı izlenir. */
export function MemberQrScreen() {
  const { data, isLoading, error, dataUpdatedAt } = useMemberAccessQr();

  // Geri sayım: QR penceresi (windowSec) her yeni QR ile sıfırlanır.
  const windowSec = data?.windowSec ?? data?.expiresIn ?? 0;
  const [remaining, setRemaining] = useState(windowSec);
  useEffect(() => {
    if (!windowSec) return;
    setRemaining(windowSec);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [windowSec, dataUpdatedAt]);

  // Check-in canlı izleme: lastCheckIn.at bir taban değerden artarsa "giriş yapıldı".
  const poll = useMemberCheckInPoll(true);
  const baselineRef = useRef<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  useEffect(() => {
    const at = poll.data?.lastCheckIn?.at ?? null;
    if (baselineRef.current === null) {
      baselineRef.current = at ?? 0;
      return;
    }
    if (at != null && at > baselineRef.current) {
      baselineRef.current = at;
      setCheckedIn(true);
    }
  }, [poll.data]);

  return (
    <ScreenContainer center>
      <Text style={styles.title}>Tesis Giriş QR</Text>
      <Muted>Turnikede / resepsiyonda okutun</Muted>

      <Card style={[styles.qrCard, checkedIn && styles.qrCardOk]}>
        {isLoading ? (
          <ActivityIndicator color={colors.green} />
        ) : error ? (
          <Text style={styles.error}>{(error as Error).message}</Text>
        ) : checkedIn ? (
          <View style={styles.okBox}>
            <Text style={styles.okMark}>✓</Text>
            <Text style={styles.okText}>Giriş yapıldı</Text>
          </View>
        ) : data?.qrDataUrl ? (
          <Image source={{ uri: data.qrDataUrl }} style={styles.qr} resizeMode="contain" />
        ) : null}
      </Card>

      {checkedIn ? (
        <Muted>Hoş geldiniz! Girişiniz kaydedildi.</Muted>
      ) : windowSec ? (
        <Muted>Yenilenmesine {remaining} sn · Güvenliğiniz için QR süreli yenilenir.</Muted>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  qrCard: {
    backgroundColor: colors.white,
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  qrCardOk: { backgroundColor: 'rgba(46,204,113,0.12)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.5)' },
  qr: { width: 248, height: 248 },
  error: { color: colors.orange, textAlign: 'center', padding: 16 },
  okBox: { alignItems: 'center', gap: 8 },
  okMark: { color: colors.green, fontSize: 64, fontWeight: '800' },
  okText: { color: colors.green, fontSize: 18, fontWeight: '800' },
});
