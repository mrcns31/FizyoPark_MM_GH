import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { staffColor } from '../../../lib/staff-color';
import { useSessions } from '../../sessions/api/hooks';
import { useStaff } from '../../staff/api/hooks';
import { toDateStr } from '../../../lib/datetime';

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

/** Web renderReportsTable mantığı — aylık personel seans tablosu. */
export function ReportsScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { contentMaxWidth, gutter, isTablet } = useResponsive();
  const [year, setYear] = useState(new Date().getFullYear());

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

      <View style={[styles.yearNav, wide]}>
        <Pressable onPress={() => setYear((y) => y - 1)} style={styles.yearBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.yearLabel}>{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} style={styles.yearBtn} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
        {isLoading ? <ActivityIndicator color={colors.accent} size="small" style={{ marginLeft: 8 }} /> : null}
      </View>

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
    </SafeAreaView>
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
  });
}
