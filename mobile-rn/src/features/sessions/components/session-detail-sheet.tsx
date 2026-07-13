import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '../../../components/bottom-sheet';
import { Badge, Button } from '../../../components/ui';
import { formatDayLabel, formatTime } from '../../../lib/datetime';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import type { PlannerSession } from '../api/sessions';

function attendanceBadge(outcome: string | null): { label: string; tone: 'green' | 'red' | 'neutral' } {
  if (outcome === 'present') return { label: 'Geldi', tone: 'green' };
  if (outcome === 'no_show') return { label: 'Gelmedi', tone: 'red' };
  return { label: 'Bekliyor', tone: 'neutral' };
}

/**
 * Seans detay + aksiyon sheet'i (admin planner, long-press ile açılır).
 */
export function SessionDetailSheet({
  group,
  onClose,
  onEdit,
  onDeleteGroup,
  onAttendance,
  busy,
}: {
  group: PlannerSession[] | null;
  onClose: () => void;
  onEdit: (anchor: PlannerSession) => void;
  onDeleteGroup: (group: PlannerSession[]) => void;
  onAttendance: (s: PlannerSession, action: 'present' | 'no_show') => void;
  busy?: boolean;
}) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const anchor = group && group.length ? group[0] : null;
  const isGroup = !!group && group.length > 1;

  return (
    <BottomSheet visible={!!anchor} onClose={onClose} title="Girişler">
      {anchor ? (
        <View style={styles.body}>
          {/* Başlık: Personel - Saat + Tarih */}
          <View style={styles.header}>
            <Text style={styles.staffTime}>
              {anchor.staffName} — {formatTime(anchor.startTs)}
            </Text>
            <Text style={styles.date}>{formatDayLabel(anchor.startTs)}</Text>
          </View>

          {/* Üye kartları */}
          {group!.map((s) => {
            const att = attendanceBadge(s.attendanceOutcome);
            const canApprove = !s.attendanceOutcome;
            return (
              <View key={s.id} style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {s.memberName || 'İsimsiz'}
                    </Text>
                    <Text style={styles.memberStatus}>{att.label}</Text>
                  </View>
                  {canApprove ? (
                    <View style={styles.attRow}>
                      <Pressable
                        style={[styles.attBtn, styles.attPresent]}
                        disabled={busy}
                        onPress={() => onAttendance(s, 'present')}
                      >
                        <Ionicons name="checkmark" size={17} color={colors.ok} />
                      </Pressable>
                      <Pressable
                        style={[styles.attBtn, styles.attNoShow]}
                        disabled={busy}
                        onPress={() => onAttendance(s, 'no_show')}
                      >
                        <Ionicons name="close" size={17} color={colors.danger} />
                      </Pressable>
                    </View>
                  ) : (
                    <Badge label={att.label} tone={att.tone} />
                  )}
                </View>
                {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
              </View>
            );
          })}

          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title={isGroup ? 'Grubu düzenle' : 'Düzenle'} variant="ghost" onPress={() => onEdit(anchor)} />
            </View>
            <View style={styles.flex}>
              <Button title={isGroup ? 'Grubu sil' : 'Sil'} variant="danger" onPress={() => onDeleteGroup(group!)} />
            </View>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    body: { gap: 10 },
    header: { gap: 2, marginBottom: 2 },
    staffTime: { color: colors.text, fontSize: 16, fontWeight: '800' },
    date: { color: colors.muted, fontSize: 13 },
    memberCard: {
      gap: 8,
      backgroundColor: surfaceTint(theme, 0.03),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
    },
    memberTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    memberInfo: { flex: 1, gap: 2 },
    memberName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    memberStatus: { color: colors.muted, fontSize: 12 },
    attRow: { flexDirection: 'row', gap: 6 },
    attBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attPresent: { borderColor: 'rgba(43,213,118,0.6)', backgroundColor: 'rgba(43,213,118,0.18)' },
    attNoShow: { borderColor: 'rgba(255,77,109,0.6)', backgroundColor: 'rgba(255,77,109,0.18)' },
    note: { color: colors.muted, fontSize: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
    flex: { flex: 1 },
  });
}
