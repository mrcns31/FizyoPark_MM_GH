import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Muted, SectionTitle } from '../../../components/ui';
import { BottomSheet } from '../../../components/bottom-sheet';
import { StarRating } from '../../../components/star-rating';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { useMyRatingSummary } from '../api/hooks';
import type { RatingBucket } from '../api/ratings';

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
        {MONTH_LONG[monthIdx]} · {m.count}/{m.eligible}
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
  const [detailMonth, setDetailMonth] = useState<number | null>(null);

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
  // Başlık, içinde bulunduğumuz ayı gösterir; yıllık toplam alttaki trend şeridinde zaten var
  const month = data.months[currentMonth];
  const monthScore = month.avg ?? month.rawAvg;

  return (
    <Card>
      <SectionTitle>Seans Puanlarım</SectionTitle>

      {month.count === 0 ? (
        <Muted>{MONTH_LONG[currentMonth]} ayında henüz puan almadınız.</Muted>
      ) : (
        <>
          <View style={styles.headRow}>
            <Text style={styles.avg}>
              {monthScore != null ? monthScore.toFixed(2) : '—'}
            </Text>
            <View style={{ gap: 2 }}>
              <StarRating value={monthScore != null ? Math.round(monthScore) : null} size={16} />
              <Muted>
                {MONTH_LONG[currentMonth]} · {month.count}/{month.eligible}
              </Muted>
              <Muted>
                {month.raters} üye
                {month.responseRate != null ? ` · yanıt %${Math.round(month.responseRate * 100)}` : ''}
              </Muted>
            </View>
          </View>

          <View style={styles.trendRow}>
            {lastSix.map((m) => {
              const b = data.months[m];
              const score = b.avg ?? b.rawAvg;
              return (
                <Pressable
                  key={m}
                  style={styles.trendItem}
                  onPress={() => b.count > 0 && setDetailMonth(m)}
                  disabled={b.count === 0}
                >
                  <Text style={styles.trendValue}>
                    {score != null ? score.toFixed(1) : '–'}
                  </Text>
                  <Text style={styles.trendMonth}>{MONTH_SHORT[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Ay detayı — yorum ve üye adı YOK, personel yalnızca kendi dağılımını görür */}
      <MonthDetailSheet
        month={detailMonth}
        bucket={detailMonth != null ? data.months[detailMonth] : null}
        year={data.year}
        onClose={() => setDetailMonth(null)}
        styles={styles}
        colors={colors}
      />
    </Card>
  );
}

/** Personelin kendi ay detayı: ortalama, puan/seans ve yıldız dağılımı. */
function MonthDetailSheet({
  month,
  bucket,
  year,
  onClose,
  styles,
  colors,
}: {
  month: number | null;
  bucket: RatingBucket | null;
  year: number;
  onClose: () => void;
  styles: any;
  colors: AppColors;
}) {
  const score = bucket ? (bucket.avg ?? bucket.rawAvg) : null;
  return (
    <BottomSheet
      visible={month != null && !!bucket}
      onClose={onClose}
      title={month != null ? `${MONTH_LONG[month]} ${year}` : ''}
    >
      {bucket ? (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <Text style={styles.detailScore}>
              {score != null ? `${score.toFixed(2)} ★` : '–'}
            </Text>
            <Muted>
              {bucket.count} / {bucket.eligible} seans
              {bucket.raters > 0 ? `  ·  ${bucket.raters} üye` : ''}
            </Muted>
          </View>

          {[5, 4, 3, 2, 1].map((n) => {
            const c = Number(bucket.distribution?.[String(n)] ?? 0);
            const pct = bucket.count > 0 ? (c / bucket.count) * 100 : 0;
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
      ) : null}
    </BottomSheet>
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
    trendValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
    detailScore: { fontSize: 28, fontWeight: '800', color: colors.text },
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
