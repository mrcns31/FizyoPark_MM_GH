import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, SectionTitle } from '../../../components/ui';
import { StarRating } from '../../../components/star-rating';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useMyRatingSummary } from '../api/hooks';

const MONTH_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTH_LONG = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

/**
 * Personelin bu ayki puanı — Takvim başlığının yanındaki kompakt rozet.
 * Puan henüz yoksa hiç çizilmez; boş bir rozet başlığı kalabalıklaştırır.
 */
export function MyRatingsBadge() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, isError } = useMyRatingSummary();

  if (isError || !data) return null;

  const monthIdx = new Date().getMonth();
  const m = data.months[monthIdx];
  if (!m || m.count === 0) return null;

  // Kendi verisine bakan personel için eşik uygulanmaz: karşılaştırma yok,
  // puan sayısı da hemen yanında duruyor (bkz. rapor ekranı — orada eşik geçerli).
  const score = m.avg ?? m.rawAvg;
  if (score == null) return null;

  return (
    <View style={styles.badge}>
      <View style={styles.badgeTop}>
        <Text style={styles.badgeScore}>{score.toFixed(2)}</Text>
        <StarRating value={Math.round(score)} size={13} />
      </View>
      <Text style={styles.badgeMeta} numberOfLines={1}>
        {MONTH_LONG[monthIdx]} · {m.count} / {m.eligible} Seans
      </Text>
    </View>
  );
}

/**
 * Personelin kendi puan özeti — son 6 ay.
 * Yorumlar ve üye bilgisi bilinçli olarak yok; backend de bu uca yorum döndürmez.
 */
export function MyRatingsCard() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data, isLoading, isError } = useMyRatingSummary();
  // Seçili ay — dağılım kart içinde her zaman açık, ay şeridinden değiştirilir
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  if (isError) return null;

  if (isLoading || !data) {
    return (
      <Card>
        <SectionTitle>Seans Puanlarım</SectionTitle>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
      </Card>
    );
  }

  const currentMonth = new Date().getMonth();
  const lastSix = Array.from({ length: 6 }, (_, i) => currentMonth - 5 + i).filter((m) => m >= 0);
  const shownMonth = selectedMonth ?? currentMonth;
  const month = data.months[shownMonth];
  const monthScore = month.avg ?? month.rawAvg;

  return (
    <Card>
      <SectionTitle>Seans Puanlarım</SectionTitle>

      {month.count === 0 ? (
        <Muted>{MONTH_LONG[shownMonth]} ayında henüz puan almadınız.</Muted>
      ) : (
        <>
          <View style={styles.headRow}>
            <Text style={styles.avg}>
              {monthScore != null ? monthScore.toFixed(2) : '—'}
            </Text>
            <View style={{ gap: 2 }}>
              <StarRating value={monthScore != null ? Math.round(monthScore) : null} size={16} />
              <Muted>
                {MONTH_LONG[shownMonth]} · {month.count} / {month.eligible} Seans
              </Muted>
              <Muted>
                {month.raters} üye
                {month.responseRate != null ? ` · yanıt %${Math.round(month.responseRate * 100)}` : ''}
              </Muted>
            </View>
          </View>

          {/* Yıldız dağılımı — sürekli açık, yıldızlarla ay şeridi arasında */}
          <View style={styles.distBox}>
            {[5, 4, 3, 2, 1].map((n) => {
              const c = Number(month.distribution?.[String(n)] ?? 0);
              const pct = month.count > 0 ? (c / month.count) * 100 : 0;
              return (
                <View key={n} style={styles.distRow}>
                  <Text style={styles.distLabel}>{n} ★</Text>
                  <View style={styles.distTrack}>
                    <View style={[styles.distFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.distCount}>{c}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.trendRow}>
            {lastSix.map((m) => {
              const b = data.months[m];
              const score = b.avg ?? b.rawAvg;
              const on = m === shownMonth;
              return (
                <Pressable
                  key={m}
                  style={[styles.trendItem, on && styles.trendItemOn]}
                  onPress={() => setSelectedMonth(m)}
                >
                  <Text style={[styles.trendValue, on && styles.trendValueOn]}>
                    {score != null ? score.toFixed(1) : '–'}
                  </Text>
                  <Text style={styles.trendMonth}>{MONTH_SHORT[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

    </Card>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },

    badge: { alignItems: 'flex-end', gap: 1 },
    badgeTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    badgeScore: { fontSize: 20, fontWeight: '800', color: colors.text },
    badgeMeta: { fontSize: 10, fontWeight: '600', color: colors.muted },
    avg: { fontSize: 32, fontWeight: '800', color: colors.text },
    trendRow: {
      flexDirection: 'row', gap: 6, marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: surfaceTint(theme, 0.08),
      paddingTop: 10,
    },
    trendItem: {
      flex: 1, alignItems: 'center', gap: 2,
      paddingVertical: 6, borderRadius: 8,
      backgroundColor: surfaceTint(theme, 0.04),
    },
    trendItemOn: { backgroundColor: 'rgba(124,92,255,0.18)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.5)' },
    trendValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
    trendValueOn: { color: colors.text },
    distBox: {
      gap: 6, marginTop: 12, paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: surfaceTint(theme, 0.08),
    },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distLabel: { color: colors.muted, fontSize: 12, width: 28, fontWeight: '600' },
    distTrack: {
      flex: 1, height: 8, borderRadius: 4,
      backgroundColor: surfaceTint(theme, 0.08), overflow: 'hidden',
    },
    distFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
    distCount: { color: colors.muted, fontSize: 12, width: 24, textAlign: 'right' },
    trendMonth: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  });
}
