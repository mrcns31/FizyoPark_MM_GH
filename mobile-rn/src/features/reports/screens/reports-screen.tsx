import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../components/screen-header';
import { BottomSheet } from '../../../components/bottom-sheet';
import { StarRating } from '../../../components/star-rating';
import { Muted } from '../../../components/ui';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { staffColor } from '../../../lib/staff-color';
import { useSessions } from '../../sessions/api/hooks';
import { useStaff } from '../../staff/api/hooks';
import { useRatingList, useStaffRatingSummary } from '../../ratings/api/hooks';
import type { RatingBucket, StaffRatingRow } from '../../ratings/api/ratings';
import { formatDayLabel, toDateStr } from '../../../lib/datetime';

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

type ReportTab = 'counts' | 'ratings';

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'counts', label: 'Seans Sayıları' },
  { key: 'ratings', label: 'Puanlar' },
];

/** Web renderReportsTable mantığı — aylık personel seans tablosu + puan tablosu. */
export function ReportsScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { contentMaxWidth, gutter, isTablet } = useResponsive();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<ReportTab>('counts');

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: sessions, isLoading } = useSessions({ startDate, endDate });
  const { data: staff } = useStaff();

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  // Aktif personel, ada göre sıralı
  const activeStaff = useMemo(
    () => (staff ?? []).slice().sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr')),
    [staff],
  );
  const activeIds = useMemo(() => new Set(activeStaff.map((s) => s.id)), [activeStaff]);

  // Aylık seans sayıları: counts[month][staffId] → n
  const { counts, monthTotals, staffTotals, grandTotal } = useMemo(() => {
    const counts: Record<number, Record<string, number>> = {};
    const monthTotals = new Array(12).fill(0);
    const staffTotals: Record<string, number> = {};
    let grandTotal = 0;

    for (const s of sessions ?? []) {
      const d = new Date(s.startTs);
      const month = d.getUTCMonth !== undefined
        ? new Date(s.startTs + 3 * 3600 * 1000).getUTCMonth()
        : d.getMonth();
      const sid = s.staffId != null ? String(s.staffId) : '__none__';
      if (!counts[month]) counts[month] = {};
      counts[month][sid] = (counts[month][sid] ?? 0) + 1;
      monthTotals[month]++;
      staffTotals[sid] = (staffTotals[sid] ?? 0) + 1;
      grandTotal++;
    }
    return { counts, monthTotals, staffTotals, grandTotal };
  }, [sessions]);

  // Eski personel: seansı olan ama aktif listede olmayan
  const formerStaff = useMemo(() => {
    const map = new Map<string, { id: number | null; name: string }>();
    for (const s of sessions ?? []) {
      if (s.staffId == null || activeIds.has(s.staffId)) continue;
      const sid = String(s.staffId);
      if (!map.has(sid)) map.set(sid, { id: s.staffId, name: s.staffName || `Eski Personel #${s.staffId}` });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [sessions, activeIds]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Raporlar" />

      {/* Sekme seçimi — yıl navigasyonu iki sekmede ortak kalır */}
      <View style={[styles.tabs, wide]}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnOn]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.yearNav, wide]}>
        <Pressable onPress={() => setYear((y) => y - 1)} style={styles.yearBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} style={styles.yearBtn} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
        {isLoading && tab === 'counts' ? <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 8 }} /> : null}
      </View>

      {tab === 'ratings' ? (
        <RatingsTable year={year} styles={styles} colors={colors} wide={wide} />
      ) : (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, wide]}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Başlık satırı */}
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.monthCell, styles.headerText]}>Ay</Text>
              {activeStaff.map((s, idx) => {
                const c = staffColor(idx, s.id);
                return (
                  <Text key={s.id} style={[styles.cell, styles.headerText, { color: c.border }]} numberOfLines={2}>
                    {s.fullName}
                  </Text>
                );
              })}
              {formerStaff.length > 0 ? (
                <Text style={[styles.cell, styles.headerText, styles.formerText]} numberOfLines={2}>
                  Eski Personeller
                </Text>
              ) : null}
              <Text style={[styles.cell, styles.totalCell, styles.headerText]}>Toplam</Text>
            </View>

            {/* Ay satırları */}
            {MONTH_NAMES.map((name, m) => {
              const total = monthTotals[m];
              return (
                <View key={m} style={[styles.row, total === 0 && styles.rowEmpty]}>
                  <Text style={[styles.cell, styles.monthCell]}>{name} {year}</Text>
                  {activeStaff.map((s, idx) => {
                    const val = counts[m]?.[String(s.id)] ?? 0;
                    const c = staffColor(idx, s.id);
                    return (
                      <Text key={s.id} style={[styles.cell, val === 0 && styles.zeroText, { color: val > 0 ? c.border : undefined }]}>
                        {val > 0 ? val : '–'}
                      </Text>
                    );
                  })}
                  {formerStaff.length > 0 ? (
                    <Text style={[styles.cell, styles.formerText]}>
                      {(() => {
                        const sum = formerStaff.reduce((acc, f) => acc + (counts[m]?.[String(f.id)] ?? 0), 0);
                        return sum > 0 ? sum : '–';
                      })()}
                    </Text>
                  ) : null}
                  <Text style={[styles.cell, styles.totalCell, total > 0 && styles.totalBold]}>
                    {total > 0 ? total : '–'}
                  </Text>
                </View>
              );
            })}

            {/* Yıllık toplam satırı */}
            <View style={[styles.row, styles.grandRow]}>
              <Text style={[styles.cell, styles.monthCell, styles.grandText]}>Yıllık Toplam</Text>
              {activeStaff.map((s, idx) => {
                const val = staffTotals[String(s.id)] ?? 0;
                const c = staffColor(idx, s.id);
                return (
                  <Text key={s.id} style={[styles.cell, styles.grandText, { color: c.border }]}>
                    {val > 0 ? val : '–'}
                  </Text>
                );
              })}
              {formerStaff.length > 0 ? (
                <Text style={[styles.cell, styles.grandText, styles.formerText]}>
                  {formerStaff.reduce((acc, f) => acc + (staffTotals[String(f.id)] ?? 0), 0) || '–'}
                </Text>
              ) : null}
              <Text style={[styles.cell, styles.totalCell, styles.grandText]}>{grandTotal || '–'}</Text>
            </View>
          </View>
        </ScrollView>

        {isLoading && (sessions ?? []).length === 0 ? null : (sessions ?? []).length === 0 && !isLoading ? (
          <Text style={[styles.empty, wide]}>{year} yılına ait seans bulunamadı.</Text>
        ) : null}
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Ortalamaya göre hücre rengi — kolon kimliği değil, değer önemli. */
function avgColor(avg: number | null, colors: AppColors): string {
  if (avg == null) return colors.muted;
  if (avg >= 4.5) return colors.ok;
  if (avg >= 4.0) return colors.text;
  return colors.fpOrange;
}

function RatingCell({ bucket, styles, colors }: { bucket: RatingBucket; styles: any; colors: AppColors }) {
  return (
    <View style={styles.ratingCell}>
      <Text style={[styles.ratingValue, { color: avgColor(bucket.avg, colors) }]}>
        {bucket.avg != null ? `${bucket.avg.toFixed(1)} ★` : '–'}
      </Text>
      {bucket.count > 0 ? (
        <Text style={styles.ratingCount}>n={bucket.count}</Text>
      ) : null}
    </View>
  );
}

/** Ay × personel puan matrisi. Eşik ve ağırlıklı ortalama backend'de hesaplanır. */
function RatingsTable({
  year,
  styles,
  colors,
  wide,
}: {
  year: number;
  styles: any;
  colors: AppColors;
  wide: object;
}) {
  const { data, isLoading } = useStaffRatingSummary(year);
  const [detail, setDetail] = useState<{ staff: StaffRatingRow; month: number | null } | null>(null);

  const rows = data?.staff ?? [];

  if (isLoading) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
  }

  if (!rows.length) {
    return <Text style={[styles.empty, wide]}>{year} yılına ait puan bulunamadı.</Text>;
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, wide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.ratingSummaryRow}>
          <Text style={styles.ratingSummaryText}>
            Kurum ortalaması: {data?.globalMean != null ? `${data.globalMean.toFixed(2)} ★` : '–'}
            {'  ·  '}
            {data?.globalCount ?? 0} puan
            {data?.grand.responseRate != null
              ? `  ·  Yanıt oranı %${Math.round(data.grand.responseRate * 100)}`
              : ''}
          </Text>
          <Text style={styles.ratingSummaryHint}>
            {data?.minSample ?? 5} puandan az olan hücrelerde ortalama gösterilmez.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.monthCell, styles.headerText]}>Ay</Text>
              {rows.map((s) => (
                <Text
                  key={String(s.staffId)}
                  style={[styles.cell, styles.headerText, s.isFormer && styles.formerText]}
                  numberOfLines={2}
                >
                  {s.staffName}
                </Text>
              ))}
            </View>

            {MONTH_NAMES.map((name, m) => {
              const empty = rows.every((s) => s.months[m].count === 0);
              return (
                <View key={m} style={[styles.row, empty && styles.rowEmpty]}>
                  <Text style={[styles.cell, styles.monthCell]}>{name} {year}</Text>
                  {rows.map((s) => (
                    <Pressable
                      key={String(s.staffId)}
                      onPress={() => s.months[m].count > 0 && setDetail({ staff: s, month: m })}
                      disabled={s.months[m].count === 0}
                    >
                      <RatingCell bucket={s.months[m]} styles={styles} colors={colors} />
                    </Pressable>
                  ))}
                </View>
              );
            })}

            {/* Yıllık satır: ağırlıklı ortalama (Σpuan / Σn), ayların basit ortalaması değil */}
            <View style={[styles.row, styles.grandRow]}>
              <Text style={[styles.cell, styles.monthCell, styles.grandText]}>Yıllık</Text>
              {rows.map((s) => (
                <Pressable
                  key={String(s.staffId)}
                  onPress={() => s.total.count > 0 && setDetail({ staff: s, month: null })}
                  disabled={s.total.count === 0}
                >
                  <RatingCell bucket={s.total} styles={styles} colors={colors} />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </ScrollView>

      <RatingDetailSheet
        detail={detail}
        year={year}
        onClose={() => setDetail(null)}
        styles={styles}
        colors={colors}
      />
    </>
  );
}

/** Hücre detayı: puan dağılımı + yorumlar (yalnızca admin/manager erişebilir) */
function RatingDetailSheet({
  detail,
  year,
  onClose,
  styles,
  colors,
}: {
  detail: { staff: StaffRatingRow; month: number | null } | null;
  year: number;
  onClose: () => void;
  styles: any;
  colors: AppColors;
}) {
  const monthParam = detail?.month != null ? detail.month + 1 : undefined;
  const { data, isLoading } = useRatingList(detail?.staff.staffId ?? null, year, monthParam);
  const bucket = detail ? (detail.month != null ? detail.staff.months[detail.month] : detail.staff.total) : null;

  const title = detail
    ? `${detail.staff.staffName} — ${detail.month != null ? MONTH_NAMES[detail.month] : 'Yıllık'} ${year}`
    : '';

  return (
    <BottomSheet visible={!!detail} onClose={onClose} title={title}>
      {detail && bucket ? (
        <View style={{ gap: 12 }}>
          <View style={styles.detailStatsRow}>
            <Text style={[styles.detailStat, { color: avgColor(bucket.avg, colors) }]}>
              {bucket.avg != null ? `${bucket.avg.toFixed(2)} ★` : 'Yetersiz veri'}
            </Text>
            <Muted>
              {bucket.count} puan
              {bucket.eligible > 0 ? ` / ${bucket.eligible} seans` : ''}
              {bucket.bayesAvg != null ? `  ·  düzeltilmiş ${bucket.bayesAvg.toFixed(2)}` : ''}
            </Muted>
          </View>

          {/* Dağılım: 5'ten 1'e çubuklar */}
          {[5, 4, 3, 2, 1].map((n) => {
            const c = Number(data?.distribution?.[String(n)] ?? 0);
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

          {isLoading ? <ActivityIndicator color={colors.accent} /> : null}

          {(data?.items ?? []).filter((i) => i.comment).length > 0 ? (
            <>
              <Text style={styles.detailSectionTitle}>Yorumlar</Text>
              {(data?.items ?? [])
                .filter((i) => i.comment)
                .map((i) => (
                  <View key={i.sessionId} style={styles.commentCard}>
                    <View style={styles.commentHead}>
                      <StarRating value={i.rating} size={14} />
                      <Text style={styles.commentMeta}>
                        {i.memberName} · {formatDayLabel(i.sessionStartTs)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{i.comment}</Text>
                  </View>
                ))}
            </>
          ) : !isLoading ? (
            <Muted>Yorum yazılmamış.</Muted>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const CELL_W = 80;
const MONTH_CELL_W = 110;
const TOTAL_CELL_W = 70;

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },

    yearNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 4,
    },
    yearBtn: {
      width: 34, height: 34,
      borderRadius: 8, borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.04),
      alignItems: 'center', justifyContent: 'center',
    },
    yearLabel: { fontSize: 18, fontWeight: '800', color: colors.text, width: 60, textAlign: 'center' },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 14 },

    row: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: surfaceTint(theme, 0.07),
      minHeight: 38,
      alignItems: 'center',
    },
    headerRow: {
      backgroundColor: surfaceTint(theme, 0.04),
      borderBottomWidth: 1,
      borderBottomColor: surfaceTint(theme, 0.12),
    },
    rowEmpty: { opacity: 0.45 },
    grandRow: {
      backgroundColor: 'rgba(124,92,255,0.08)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(124,92,255,0.2)',
      marginTop: 2,
    },

    cell: {
      width: CELL_W,
      paddingHorizontal: 6,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
    },
    monthCell: { width: MONTH_CELL_W, textAlign: 'left', paddingLeft: 10 },
    totalCell: { width: TOTAL_CELL_W },
    headerText: { fontSize: 11, fontWeight: '700', color: colors.muted },
    formerText: { color: surfaceTint(theme, 0.4) },
    zeroText: { color: surfaceTint(theme, 0.2) },
    totalBold: { fontWeight: '800', color: colors.text },
    grandText: { fontWeight: '800', color: colors.text },

    // ── Sekmeler ──
    tabs: { flexDirection: 'row', gap: 6, paddingTop: 8 },
    tabBtn: {
      flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, backgroundColor: surfaceTint(theme, 0.03),
    },
    tabBtnOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
    tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    tabTextOn: { color: colors.text },

    // ── Puan tablosu ──
    ratingSummaryRow: { paddingBottom: 10, gap: 2 },
    ratingSummaryText: { color: colors.text, fontSize: 13, fontWeight: '700' },
    ratingSummaryHint: { color: colors.muted, fontSize: 11 },
    ratingCell: { width: CELL_W, paddingVertical: 6, alignItems: 'center' },
    ratingValue: { fontSize: 13, fontWeight: '700' },
    ratingCount: { color: surfaceTint(theme, 0.35), fontSize: 10, fontWeight: '600' },

    // ── Detay sheet ──
    detailStatsRow: { gap: 2 },
    detailStat: { fontSize: 22, fontWeight: '800' },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distLabel: { color: colors.muted, fontSize: 12, width: 28, fontWeight: '600' },
    distTrack: {
      flex: 1, height: 8, borderRadius: 4,
      backgroundColor: surfaceTint(theme, 0.08), overflow: 'hidden',
    },
    distFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
    distCount: { color: colors.muted, fontSize: 12, width: 24, textAlign: 'right' },
    detailSectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
    commentCard: {
      backgroundColor: surfaceTint(theme, 0.04),
      borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      padding: 10, gap: 6,
    },
    commentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    commentMeta: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    commentText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  });
}
