import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '../../../components/bottom-sheet';
import { Badge, Button } from '../../../components/ui';
import { formatSessionRange, formatDayLabel } from '../../../lib/datetime';
import { colors } from '../../../theme/colors';
import type { PlannerSession } from '../api/sessions';

type IoniconName = keyof typeof Ionicons.glyphMap;

function Row({ icon, value }: { icon: IoniconName; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.muted} style={styles.rowIcon} />
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function attendance(outcome: string | null): { label: string; tone: 'green' | 'red' | 'neutral' } {
  if (outcome === 'present') return { label: 'Geldi', tone: 'green' };
  if (outcome === 'no_show') return { label: 'Gelmedi', tone: 'red' };
  return { label: 'Yoklama bekliyor', tone: 'neutral' };
}

/**
 * Seans detay + aksiyon sheet'i (admin planner). Bir slot grubunu (aynı personel+saat)
 * gösterir: her üye için yoklama (Geldi/Gelmedi), grup için Düzenle / Sil.
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
  const anchor = group && group.length ? group[0] : null;
  const isGroup = !!group && group.length > 1;
  const title = anchor ? (isGroup ? `Grup seans (${group!.length})` : anchor.memberName || 'Seans') : 'Seans';

  return (
    <BottomSheet visible={!!anchor} onClose={onClose} title={title}>
      {anchor ? (
        <View style={styles.body}>
          <View style={styles.headRow}>
            <Text style={styles.time}>{formatSessionRange(anchor.startTs, anchor.endTs)}</Text>
          </View>
          <Text style={styles.date}>{formatDayLabel(anchor.startTs)}</Text>

          <View style={styles.info}>
            <Row icon="people-outline" value={anchor.staffName} />
            <Row icon="business-outline" value={anchor.roomName} />
          </View>

          {/* Üyeler — her biri için yoklama */}
          {group!.map((s) => {
            const att = attendance(s.attendanceOutcome);
            return (
              <View key={s.id} style={styles.memberCard}>
                <View style={styles.memberTop}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {s.memberName || 'İsimsiz'}
                  </Text>
                  <Badge label={att.label} tone={att.tone} />
                </View>
                {!s.attendanceOutcome ? (
                  <View style={styles.attRow}>
                    <View style={styles.flex}>
                      <Button title="Geldi" variant="primary" onPress={() => onAttendance(s, 'present')} disabled={busy} />
                    </View>
                    <View style={styles.flex}>
                      <Button title="Gelmedi" variant="danger" onPress={() => onAttendance(s, 'no_show')} disabled={busy} />
                    </View>
                  </View>
                ) : null}
                {s.note ? <Row icon="document-text-outline" value={s.note} /> : null}
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

const styles = StyleSheet.create({
  body: { gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  time: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  date: { color: colors.muted, fontSize: 13, marginTop: -6 },
  info: {
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  memberCard: {
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  memberTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memberName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  attRow: { flexDirection: 'row', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { width: 18 },
  rowValue: { flex: 1, color: colors.text, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
