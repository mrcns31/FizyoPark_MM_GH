import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../../components/screen-container';
import { Card, Muted } from '../../../components/ui';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import { useMemberAccessQr, useMemberCheckInPoll } from '../api/hooks';

/** Ekran odaklandığı andan itibaren en fazla bu kadar açık kalır — okutulsa da okutulmasa da kapanır (web parity). */
const QR_SCREEN_ACTIVE_MS = 15_000;

/** Tesis giriş QR kodu — ekran odaktayken 15sn boyunca açık kalır, check-in canlı izlenir, süre dolunca kapanır. */
export function MemberQrScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(QR_SCREEN_ACTIVE_MS / 1000);
  const [checkedIn, setCheckedIn] = useState(false);
  const checkedInRef = useRef(false);
  const baselineRef = useRef<number | null>(null);

  const { data, isLoading, error } = useMemberAccessQr(active);
  const poll = useMemberCheckInPoll(active && !checkedIn);

  useFocusEffect(
    useCallback(() => {
      checkedInRef.current = false;
      baselineRef.current = null;
      setCheckedIn(false);
      setRemaining(QR_SCREEN_ACTIVE_MS / 1000);
      setActive(true);

      const closeTimer = setTimeout(() => {
        setActive(false);
        if (!checkedInRef.current) router.replace('/(member)');
      }, QR_SCREEN_ACTIVE_MS);

      return () => {
        clearTimeout(closeTimer);
        setActive(false);
      };
    }, [router])
  );

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Check-in canlı izleme: lastCheckIn.at bir taban değerden artarsa "giriş yapıldı".
  useEffect(() => {
    const at = poll.data?.lastCheckIn?.at ?? null;
    if (baselineRef.current === null) {
      baselineRef.current = at ?? 0;
      return;
    }
    if (at != null && at > baselineRef.current) {
      baselineRef.current = at;
      checkedInRef.current = true;
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
      ) : (
        <Muted>Kapanmasına {remaining} sn</Muted>
      )}
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
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
}
