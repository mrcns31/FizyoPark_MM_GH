import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { DateField } from '../../../components/date-field';
import { TimeField } from '../../../components/time-field';
import { SelectField } from '../../../components/select-field';
import { FormField } from '../../../components/form';
import { Button, Card } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { getMembers } from '../../members/api/members';
import { getStaff } from '../../staff/api/staff';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import { sessionKeys, useCreateSession, useDeleteSession, useSessions, useUpdateSession } from '../api/hooks';
import { useWorkingHours } from '../../settings/api/hooks';
import { useMemberPackages } from '../../member-packages/api/hooks';
import { isAttendanceConfirmed, type PlannerSession } from '../api/sessions';
import { promptAdminPassword } from '../../../lib/admin-password';

/** Date → "YYYY-MM-DD" (yerel). */
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** "YYYY-MM-DD" tarihini al, saati koru. */
function mergeDate(base: Date, dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return base;
  return new Date(y, m - 1, d, base.getHours(), 0, 0, 0);
}
/** "HH:00" saatini al, tarihi koru (dakika hep 00). */
function mergeTime(base: Date, timeStr: string): Date {
  const h = parseInt(timeStr.split(':')[0], 10) || 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0, 0);
}

/**
 * Seans oluştur/düzenle (modal sheet) — web "Grup Seans" modalı paritesi.
 * Her iki modda da ÇOKLU üye: personel/oda/tarih/saat + üye listesi.
 * - Yeni (FAB): her üyeye seans oluşturur.
 * - Düzenleme (?id=&date=): o slottaki grubu doldurur; kaydette ekle→oluştur,
 *   çıkar→sil, slot/personel/oda değişince kalanları günceller.
 */
export function SessionFormScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id?: string; date?: string; defaultTs?: string; singleEdit?: string; forceMemberId?: string; forceMemberPackageId?: string }>();
  const forceMemberId = params.forceMemberId ? Number(params.forceMemberId) : null;
  const forceMemberPackageId = params.forceMemberPackageId ? Number(params.forceMemberPackageId) : null;
  const create = useCreateSession();
  const update = useUpdateSession();
  const del = useDeleteSession();

  const { data: daySessions } = useSessions(
    params.date ? { startDate: params.date, endDate: params.date } : {}
  );
  const editing = params.id ? daySessions?.find((s) => s.id === Number(params.id)) : undefined;

  // singleEdit=1 → sadece bu seans (paket listesinden açılış); aksi halde aynı slottaki grup.
  const groupSessions = useMemo<PlannerSession[]>(() => {
    if (!editing) return [];
    if (params.singleEdit === '1') return [editing];
    return (daySessions ?? []).filter(
      (s) =>
        s.staffId === editing.staffId &&
        s.startTs === editing.startTs,
    );
  }, [editing, daySessions, params.singleEdit]);

  const membersQ = useQuery({ queryKey: ['members'], queryFn: getMembers });
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: getStaff });

  const [staffId, setStaffId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [memberIds, setMemberIds] = useState<number[]>(() => forceMemberId != null ? [forceMemberId] : []);
  const [note, setNote] = useState('');
  const [start, setStart] = useState<Date>(() => {
    const d = new Date(params.defaultTs ? Number(params.defaultTs) : Date.now());
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [inited, setInited] = useState(false);

  // Düzenleme verisi yüklenince formu bir kez doldur.
  useEffect(() => {
    if (editing && !inited) {
      setStaffId(editing.staffId);
      setRoomId(editing.roomId ?? null);
      setMemberIds(groupSessions.map((s) => s.memberId).filter((x): x is number => x != null));
      setNote(editing.note ?? '');
      const d = new Date(editing.startTs);
      d.setMinutes(0, 0, 0);
      setStart(d);
      setInited(true);
    }
  }, [editing, groupSessions, inited]);

  // Not alanı yalnızca tekil seans düzenlemede (web grup modalında not yok).
  const singleEdit = !!editing && groupSessions.length <= 1;

  // Süre: düzenlemede mevcut süre korunur, yeni seansta 60 dk (web ile aynı).
  const durationMin = editing ? Math.max(30, Math.round((editing.endTs - editing.startTs) / 60000)) : 60;

  // Seçili günün çalışma saatleri → saat seçimini sınırla.
  const { data: workingHours } = useWorkingHours();
  const dow = start.getDay();
  const dayWh = workingHours?.[dow];
  const minHour = dayWh ? parseInt(dayWh.start.split(':')[0], 10) : 8;
  const maxHour = dayWh ? Math.max(minHour, parseInt(dayWh.end.split(':')[0], 10) - 1) : 21;

  // Yeni seansta saat çalışma saatleri dışındaysa başlangıca kenetle (web yeni grup
  // modalı saati tesis başlangıç saatine ayarlar). Düzenlemede dokunma.
  useEffect(() => {
    if (editing) return;
    const h = start.getHours();
    if (h < minHour || h > maxHour) {
      setStart((d) => {
        const n = new Date(d);
        n.setHours(minHour, 0, 0, 0);
        return n;
      });
    }
  }, [editing, minHour, maxHour, start]);

  // Sadece aktif paketi olan üyelere seans açılabilir (backend de zorunlu kılıyor).
  const { data: allPackages } = useMemberPackages();
  const activeMemberIds = useMemo(() => {
    const set = new Set<number>();
    for (const mp of allPackages ?? []) if (mp.status === 'active') set.add(mp.memberId);
    return set;
  }, [allPackages]);

  const members = membersQ.data ?? [];
  const memberName = (id: number) => members.find((m) => m.id === id)?.name ?? `#${id}`;

  // Eklenebilir üyeler: aktif paketli & henüz eklenmemiş. Forced member aktif olmasa da dahil.
  const addableOptions = members
    .filter((m) => (activeMemberIds.has(m.id) || m.id === forceMemberId) && !memberIds.includes(m.id))
    .map((m) => ({ label: m.name, value: m.id }));

  // Personeli o günün çalışma gününe göre filtrele (çalışma saati tanımlıysa).
  const staffOptions = (staffQ.data ?? [])
    .filter((s) => {
      const wh = s.workingHours?.[dow];
      return !wh || wh.enabled;
    })
    .map((s) => ({ label: s.fullName, value: s.id }));

  async function onSave() {
    if (!staffId) return Alert.alert('Eksik bilgi', 'Personel zorunludur.');
    if (memberIds.length === 0) return Alert.alert('Eksik bilgi', 'En az bir üye ekleyin.');

    const startTs = start.getTime();
    const endTs = startTs + durationMin * 60000;

    // Personelin o günkü çalışma saati aralığı kontrolü — web paritesi
    let skipStaffHoursCheck = false;
    const selectedStaff = (staffQ.data ?? []).find((s) => s.id === staffId);
    if (selectedStaff) {
      const staffWh = selectedStaff.workingHours?.[dow];
      if (staffWh?.enabled) {
        const parseMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
        const startMinDay = start.getHours() * 60 + start.getMinutes();
        if (startMinDay < parseMin(staffWh.start) || startMinDay + durationMin > parseMin(staffWh.end)) {
          const pwd = await promptAdminPassword(
            `${selectedStaff.fullName} bu saat aralığında çalışmıyor (${staffWh.start}–${staffWh.end}).\n\nDevam etmek için admin şifresi gerekiyor.`
          );
          if (pwd == null) return;
          skipStaffHoursCheck = true;
        }
      }
    }

    try {
      if (editing) {
        const byMember = new Map(groupSessions.map((s) => [s.memberId, s]));
        const keep = new Set(memberIds);
        const slotChanged = (ex: PlannerSession) =>
          ex.staffId !== staffId ||
          (ex.roomId ?? null) !== (roomId ?? null) ||
          ex.startTs !== startTs ||
          ex.endTs !== endTs ||
          (singleEdit && note !== (ex.note ?? '')); // tekil: not değişince de güncelle
        const removed = groupSessions.filter((s) => s.memberId == null || !keep.has(s.memberId));
        const updated = memberIds
          .map((mid) => byMember.get(mid))
          .filter((ex): ex is PlannerSession => !!ex && slotChanged(ex));

        // Onaylanmış seans değişiyor/siliniyorsa tek seferde admin şifresi (web paritesi).
        let adminPassword: string | undefined;
        if ([...removed, ...updated].some((s) => isAttendanceConfirmed(s))) {
          const pwd = await promptAdminPassword('Girişi onaylanmış seans(lar) üzerinde değişiklik için admin şifrenizi girin.');
          if (pwd == null) return;
          adminPassword = pwd;
        }

        // Eklenen/güncellenen üyeler
        for (const mid of memberIds) {
          const ex = byMember.get(mid);
          if (ex) {
            if (slotChanged(ex)) {
              await update.mutateAsync({
                id: ex.id,
                data: { memberId: mid, staffId, roomId: roomId ?? null, startTs, endTs, note: singleEdit ? note : ex.note ?? '', skipStaffHoursCheck },
                adminPassword,
              });
            }
          } else {
            await create.mutateAsync({ memberId: mid, staffId, roomId: roomId ?? null, startTs, endTs, note: '', skipStaffHoursCheck });
          }
        }
        // Çıkarılan üyeler → sil
        for (const s of removed) {
          await del.mutateAsync({ id: s.id, adminPassword });
        }
      } else {
        for (const mid of memberIds) {
          const isForcedMember = forceMemberId != null && mid === forceMemberId;
          await create.mutateAsync({
            memberId: mid, staffId, roomId: roomId ?? null, startTs, endTs, note: '',
            skipStaffHoursCheck,
            ...(isForcedMember && forceMemberPackageId != null ? { memberPackageId: forceMemberPackageId, skipTrim: true } : {}),
          });
        }
      }
      // Her iki cache'i bekle, sonra geri dön
      await Promise.all([
        qc.invalidateQueries({ queryKey: sessionKeys.all }),
        qc.invalidateQueries({ queryKey: ['member-package-sessions'] }),
      ]);
      router.back();
    } catch (e) {
      Alert.alert('Hata', e instanceof ApiError ? e.message : 'Kayıt başarısız');
    }
  }

  function stepStaff(dir: 1 | -1) {
    if (staffOptions.length === 0) return;
    const idx = staffOptions.findIndex((o) => o.value === staffId);
    if (idx === -1) { setStaffId(staffOptions[0].value); return; }
    const next = idx + dir;
    if (next < 0 || next >= staffOptions.length) return;
    setStaffId(staffOptions[next].value);
  }

  const saving = create.isPending || update.isPending || del.isPending;
  const title = editing ? (groupSessions.length > 1 ? 'Grup seans düzenle' : 'Seans düzenle') : forceMemberPackageId != null ? 'Pakete seans ekle' : 'Grup seans ekle';

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title }} />
      <Card style={styles.card}>
        <View style={styles.dtRow}>
          <Text style={styles.label}>Personel<Text style={styles.req}> *</Text></Text>
          <View style={styles.arrowRow}>
            <Pressable hitSlop={8} style={styles.arrowBtn} onPress={() => stepStaff(-1)}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.arrowField}>
              <SelectField label="" value={staffId} onChange={setStaffId} options={staffOptions} />
            </View>
            <Pressable hitSlop={8} style={styles.arrowBtn} onPress={() => stepStaff(1)}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Tarih</Text>
          <View style={styles.arrowRow}>
            <Pressable
              hitSlop={8}
              style={styles.arrowBtn}
              onPress={() => setStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.arrowField}>
              <DateField value={dateToStr(start)} onChange={(v) => setStart(mergeDate(start, v))} />
            </View>
            <Pressable
              hitSlop={8}
              style={styles.arrowBtn}
              onPress={() => setStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.label, { marginTop: 10 }]}>Saat</Text>
          <View style={styles.arrowRow}>
              <Pressable
                hitSlop={8}
                style={styles.arrowBtn}
                onPress={() => setStart((d) => {
                  const h = d.getHours();
                  if (h <= minHour) return d;
                  const n = new Date(d); n.setHours(h - 1, 0, 0, 0); return n;
                })}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <View style={styles.arrowField}>
                <TimeField
                  value={`${String(start.getHours()).padStart(2, '0')}:00`}
                  hourOnly
                  minHour={minHour}
                  maxHour={maxHour}
                  onChange={(v) => setStart(mergeTime(start, v))}
                />
              </View>
              <Pressable
                hitSlop={8}
                style={styles.arrowBtn}
                onPress={() => setStart((d) => {
                  const h = d.getHours();
                  if (h >= maxHour) return d;
                  const n = new Date(d); n.setHours(h + 1, 0, 0, 0); return n;
                })}
              >
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
            </View>
        </View>

        <View>
          <Text style={styles.label}>Üyeler {memberIds.length ? `(${memberIds.length})` : ''}</Text>
          {memberIds.map((mid) => (
            <View key={mid} style={styles.memberRow}>
              <Text style={styles.memberName} numberOfLines={1}>{memberName(mid)}</Text>
              {(forceMemberId == null || mid !== forceMemberId) && (
                <Pressable
                  hitSlop={8}
                  style={styles.removeBtn}
                  onPress={() => setMemberIds((ids) => ids.filter((x) => x !== mid))}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              )}
            </View>
          ))}
          <SelectField
            label=""
            value={null}
            onChange={(v) => setMemberIds((ids) => (ids.includes(v) ? ids : [...ids, v]))}
            options={addableOptions}
            placeholder={addableOptions.length ? '+ Üye ekle' : 'Eklenecek aktif paketli üye yok'}
            searchable
          />
        </View>

        {singleEdit ? <FormField label="Not" value={note} onChangeText={setNote} multiline /> : null}
      </Card>

      <Button title={editing ? 'Güncelle' : 'Oluştur'} onPress={onSave} loading={saving} style={styles.submit} />
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    card: { gap: 14, marginTop: 8 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    req: { color: colors.danger },
    dtRow: { flexDirection: 'column', gap: 0 },
    arrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    arrowBtn: {
      width: 34, height: 34,
      borderRadius: 8, borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.05),
      alignItems: 'center', justifyContent: 'center',
    },
    arrowField: { flex: 1 },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      marginBottom: 8,
    },
    memberName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
    removeBtn: { padding: 2 },
    submit: { marginTop: 14, marginBottom: 8 },
  });
}
