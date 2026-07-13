import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { DateField } from '../../../components/date-field';
import { TimeField } from '../../../components/time-field';
import { SelectField } from '../../../components/select-field';
import { Badge, Button, Card, ErrorBox, Muted, SectionTitle } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { useTheme } from '../../theme';
import { surfaceTint, type AppColors, type ResolvedTheme } from '../../../theme/colors';
import type { MemberPackage } from '../../../types/api';
import {
  type AvailabilityConflict,
  type SlotInput,
  type SlotOverride,
} from '../../member-packages/api/member-packages';
import { usePackages } from '../../packages/api/hooks';
import { useStaff } from '../../staff/api/hooks';
import { useWorkingHours } from '../../settings/api/hooks';
import {
  useCreateMemberPackage,
  useEndMemberPackage,
  useMemberPackages,
  useUpdateMemberPackage,
} from '../../member-packages/api/hooks';
import { useMembers } from '../api/hooks';

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
// Web `getMemberPackageSlotDaysOrder`: hafta içi → Cmt → Paz sırası.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function fmtTR(v: string): string {
  if (!v) return '–';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}
function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
/** "YYYY-MM-DD" + ay → "YYYY-MM-DD" (web ay-aşım hesabıyla aynı). */
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1 + months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function statusLabel(s: string): { label: string; tone: 'green' | 'neutral' | 'red' } {
  if (s === 'active') return { label: 'Aktif', tone: 'green' };
  if (s === 'completed') return { label: 'Tamamlandı', tone: 'neutral' };
  if (s === 'cancelled') return { label: 'İptal', tone: 'red' };
  return { label: s, tone: 'neutral' };
}

interface DayRow {
  checked: boolean;
  startTime: string;
  staffId: number | null;
}

/** Üyeye paket tanımlama — web `openMemberPackageModal`/`saveMemberPackageFromForm` birebir. */
export function MemberPackageScreen() {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { memberId: memberIdParam, packageId: packageIdParam } = useLocalSearchParams<{
    memberId?: string;
    packageId?: string;
  }>();
  const memberId = memberIdParam ? Number(memberIdParam) : undefined;
  const router = useRouter();

  const { data: members } = useMembers();
  const member = members?.find((m) => m.id === memberId);
  const { data: packages } = usePackages();
  const { data: staff } = useStaff();
  const { data: workingHours } = useWorkingHours();
  const { data: memberPackages } = useMemberPackages(memberId);
  const create = useCreateMemberPackage();
  const update = useUpdateMemberPackage();
  const endPkg = useEndMemberPackage();

  const [editingId, setEditingId] = useState<number | null>(null);

  const hasActive = useMemo(
    () => (memberPackages ?? []).some((mp) => mp.status === 'active'),
    [memberPackages],
  );

  // Tesisin açık günleri (genel çalışma saatleri); hiçbiri yoksa tüm günler.
  const openDays = useMemo(() => {
    const enabled = DAY_ORDER.filter((d) => workingHours?.[d]?.enabled);
    return enabled.length ? enabled : DAY_ORDER;
  }, [workingHours]);

  const [packageId, setPackageId] = useState<number | null>(
    packageIdParam ? Number(packageIdParam) : null,
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [skipDist, setSkipDist] = useState(false);
  const [days, setDays] = useState<Record<number, DayRow>>({});
  const [error, setError] = useState<string | null>(null);

  // Çakışma çözümleme state'i
  const [conflicts, setConflicts] = useState<AvailabilityConflict[]>([]);
  const [overrides, setOverrides] = useState<Record<string, SlotOverride>>({});
  const [editingConflict, setEditingConflict] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editStaffId, setEditStaffId] = useState<number | null>(null);

  // Conflict çözümlenme sayısı
  const unresolvedCount = conflicts.filter((c) => c.date && !overrides[c.date]).length;

  function monthsFor(pkgId: number | null): number {
    const p = (packages ?? []).find((x) => x.id === pkgId);
    return p ? Number(p.monthOverrun ?? 0) || 1 : 1;
  }

  // Paket seçilince: başlangıç=bugün, bitiş=bugün + ay-aşım (web ile birebir).
  function onPickPackage(id: number) {
    setPackageId(id);
    const start = todayStr();
    setStartDate(start);
    setEndDate(addMonths(start, monthsFor(id)));
  }
  // Başlangıç değişince bitişi yeniden hesapla (elle de değiştirilebilir).
  function onPickStart(v: string) {
    setStartDate(v);
    if (v) setEndDate(addMonths(v, monthsFor(packageId)));
  }

  /** O günün çalışma saati aralığı: [açılış saati, son seans saati=kapanış-1]. */
  function dayHourRange(d: number): { min: number; max: number; openStr: string } {
    const wh = workingHours?.[d];
    const open = wh ? parseInt(wh.start.split(':')[0], 10) : 8;
    const close = wh ? parseInt(wh.end.split(':')[0], 10) : 21;
    return { min: open, max: Math.max(open, close - 1), openStr: `${String(open).padStart(2, '0')}:00` };
  }

  function toggleDay(d: number) {
    setDays((prev) => {
      const cur = prev[d];
      if (cur?.checked) return { ...prev, [d]: { ...cur, checked: false } };
      const openStr = dayHourRange(d).openStr;
      return { ...prev, [d]: { checked: true, startTime: cur?.startTime || openStr, staffId: cur?.staffId ?? null } };
    });
  }
  function setDay(d: number, patch: Partial<DayRow>) {
    setDays((prev) => ({ ...prev, [d]: { ...(prev[d] ?? { checked: true, startTime: '18:00', staffId: null }), ...patch } }));
  }

  function resetForm() {
    setEditingId(null);
    setPackageId(null);
    setStartDate('');
    setEndDate('');
    setSkipDist(false);
    setDays({});
    setError(null);
    setConflicts([]);
    setOverrides({});
    setEditingConflict(null);
  }

  /** Mevcut paketi forma yükle (web "Düzenle"). */
  function onEdit(mp: MemberPackage) {
    setError(null);
    setEditingId(mp.id);
    setPackageId(mp.packageId);
    setStartDate(mp.startDate.slice(0, 10));
    setEndDate(mp.endDate.slice(0, 10));
    setSkipDist(!!mp.skipDayDistribution);
    const next: Record<number, DayRow> = {};
    for (const s of mp.slots ?? []) {
      next[s.dayOfWeek] = { checked: true, startTime: s.startTime.slice(0, 5), staffId: s.staffId };
    }
    setDays(next);
  }

  async function onSave() {
    setError(null);
    if (!memberId) return setError('Üye seçili değil.');
    if (!editingId && hasActive) {
      return setError('Bu üyenin zaten aktif bir paketi var. Yeni paket için önce mevcut paketi "Sonlandır" ile kapatın.');
    }
    if (!packageId) return setError('Paket seçin.');
    if (!startDate || !endDate) return setError('Başlangıç ve bitiş tarihi girin.');
    if (endDate < startDate) return setError('Bitiş tarihi başlangıçtan önce olamaz.');

    let slots: SlotInput[] = [];
    if (!skipDist) {
      const checkedDays = openDays.filter((d) => days[d]?.checked);
      if (checkedDays.length === 0) return setError('En az bir gün seçin.');
      for (const d of checkedDays) {
        const row = days[d];
        if (!row.startTime || row.staffId == null) {
          return setError('Seçili günler için saat ve personel seçiniz.');
        }
      }
      slots = checkedDays.map((d) => ({ dayOfWeek: d, startTime: days[d].startTime, staffId: days[d].staffId }));
    }

    // Web ile aynı akış: direkt kaydet, 409 gelirse conflict modal açılır
    await doSave(slots, []);
  }

  /** Tüm çakışmalar çözüldükten sonra override listesiyle kaydet. */
  async function doSave(slots: SlotInput[], slotOverrides: SlotOverride[]) {
    if (!memberId) return;
    const today = todayStr();
    const onDone = (n: number | null, verb: string) => {
      Alert.alert(verb, n != null && n > 0 ? `${n} seans oluşturuldu.` : 'İşlem başarılı.');
      resetForm();
    };
    const onErr = (e: unknown) => {
      // PUT 409 → çakışmaları güncelle
      if (e instanceof ApiError && e.status === 409) {
        const data = (e as any).data as { conflicts?: AvailabilityConflict[] };
        if (Array.isArray(data?.conflicts) && data.conflicts.length > 0) {
          setConflicts(data.conflicts);
          setOverrides({});
          setEditingConflict(null);
          return;
        }
      }
      setError(e instanceof ApiError ? e.message : 'İşlem başarısız.');
    };

    if (editingId) {
      update.mutate(
        { id: editingId, body: { packageId: packageId ?? undefined, startDate, endDate, skipDayDistribution: skipDist, slots, effectiveDate: today, slotOverrides } },
        { onSuccess: (mp) => onDone(mp.sessionsCreated, 'Paket güncellendi'), onError: onErr },
      );
    } else {
      create.mutate(
        { memberId, packageId: packageId!, startDate, endDate, skipDayDistribution: skipDist, slots, slotOverrides: slotOverrides.length > 0 ? slotOverrides : undefined },
        { onSuccess: (mp) => onDone(mp.sessionsCreated, 'Paket tanımlandı'), onError: onErr },
      );
    }
  }

  /** Conflict çakışması için Düzenle: inline edit başlat. */
  function onConflictEdit(date: string, currentTime: string, currentStaffId: number | null) {
    setEditingConflict(date);
    setEditTime(currentTime);
    setEditStaffId(currentStaffId);
  }

  /** Düzenlemeyi uygula. */
  function onConflictApplyEdit(date: string) {
    if (!editStaffId) return;
    setOverrides((prev) => ({ ...prev, [date]: { date, startTime: editTime, staffId: editStaffId } }));
    setEditingConflict(null);
  }

  /** Çakışmayı atla → seans sonraki uygun tarihe kayar. */
  function onConflictSkip(date: string) {
    setOverrides((prev) => ({ ...prev, [date]: { date, skip: true } }));
    setEditingConflict(null);
  }

  /** Tüm çakışmalar çözüldükten sonra kaydet. */
  async function onConflictSave() {
    if (!memberId) return;
    const checkedDays = openDays.filter((d) => days[d]?.checked);
    const slots: SlotInput[] = checkedDays.map((d) => ({
      dayOfWeek: d, startTime: days[d].startTime, staffId: days[d].staffId,
    }));
    const slotOverrides = Object.values(overrides);
    await doSave(slots, slotOverrides);
  }

  function onEnd(id: number) {
    Alert.alert('Paketi sonlandır', 'Bu paket sonlandırılsın mı? Gelecek seanslar iptal edilir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sonlandır',
        style: 'destructive',
        onPress: () => endPkg.mutate({ id }, { onError: (e) => Alert.alert('Hata', (e as Error).message) }),
      },
    ]);
  }


  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ title: 'Paketler' }} />
      {member ? <Text style={styles.memberName}>{member.name}</Text> : null}

      <SectionTitle>Mevcut Paketler</SectionTitle>
      <View style={styles.list}>
        {(memberPackages ?? []).length === 0 ? (
          <Card>
            <Muted>Bu üyenin paketi yok.</Muted>
          </Card>
        ) : null}
        {(memberPackages ?? []).map((mp) => {
          const st = statusLabel(mp.status);
          return (
            <View key={mp.id} style={styles.pkgItem}>
              <View style={styles.pkgLeft}>
                <Text style={styles.pkgName}>{mp.packageName}</Text>
                <Text style={styles.pkgMeta}>
                  {fmtTR(mp.startDate)} – {fmtTR(mp.endDate)} · {mp.lessonCount} ders
                </Text>
              </View>
              <Badge label={st.label} tone={st.tone} />
              <Pressable
                style={styles.iconBtn}
                hitSlop={6}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/members/package-sessions',
                    params: { memberPackageId: String(mp.id), packageName: mp.packageName, memberId: memberId != null ? String(memberId) : undefined },
                  })
                }
              >
                <Ionicons name="list-outline" size={16} color={colors.muted} />
              </Pressable>
              {mp.status === 'active' ? (
                <>
                  <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => onEdit(mp)}>
                    <Ionicons name="create-outline" size={16} color={colors.muted} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => onEnd(mp.id)}>
                    <Ionicons name="stop-circle-outline" size={16} color={colors.danger} />
                  </Pressable>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      {!hasActive || editingId ? (
      <View style={styles.formHead}>
        <SectionTitle>{editingId ? 'Paketi Düzenle' : 'Yeni Paket Tanımla'}</SectionTitle>
        {editingId ? (
          <Pressable onPress={resetForm} hitSlop={6}>
            <Text style={styles.cancelEdit}>Vazgeç</Text>
          </Pressable>
        ) : null}
      </View>
      ) : null}
      {!hasActive || editingId ? <Card style={styles.form}>
        <SelectField
          label="Paket"
          required
          value={packageId}
          onChange={onPickPackage}
          options={(packages ?? []).map((p) => ({ label: `${p.name} (${p.lessonCount} ders)`, value: p.id }))}
        />
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={styles.label}>Başlangıç</Text>
            <DateField value={startDate} onChange={onPickStart} />
          </View>
          <View style={styles.dateCol}>
            <Text style={styles.label}>Bitiş</Text>
            <DateField value={endDate} onChange={setEndDate} />
          </View>
        </View>

        <Pressable style={styles.skipRow} onPress={() => setSkipDist((v) => !v)} hitSlop={6}>
          <View style={[styles.check, skipDist && styles.checkOn]}>
            {skipDist ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
          </View>
          <Text style={styles.skipText}>Haftalık gün dağılımı yapma (seansları sonra elle ekle)</Text>
        </Pressable>

        {!skipDist ? (
          <View style={styles.slots}>
            <Text style={styles.label}>Haftalık günler</Text>
            {openDays.map((d) => {
              const row = days[d];
              const checked = !!row?.checked;
              const hr = dayHourRange(d);
              return (
                <View key={d} style={[styles.dayCard, checked && styles.dayCardOn]}>
                  <Pressable style={styles.dayToggle} onPress={() => toggleDay(d)} hitSlop={6}>
                    <View style={[styles.check, checked && styles.checkOn]}>
                      {checked ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                    </View>
                    <Text style={styles.dayName}>{DAY_NAMES[d]}</Text>
                  </Pressable>
                  {checked ? (
                    <>
                      <View style={styles.dayTime}>
                        <TimeField
                          value={row.startTime}
                          hourOnly
                          minHour={hr.min}
                          maxHour={hr.max}
                          onChange={(v) => setDay(d, { startTime: v })}
                        />
                      </View>
                      <View style={styles.dayStaff}>
                        <SelectField
                          label=""
                          placeholder="Personel"
                          value={row.staffId}
                          onChange={(v) => setDay(d, { staffId: v })}
                          options={(staff ?? []).map((st) => ({ label: st.fullName, value: st.id }))}
                        />
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {error ? <ErrorBox>{error}</ErrorBox> : null}

        {/* Çakışma Çözümleme Bölümü */}
        {conflicts.length > 0 ? (
          <View style={styles.conflictSection}>
            <Text style={styles.conflictTitle}>⚠️ Randevu Çakışmaları</Text>
            <Text style={styles.conflictSubtitle}>
              Tümü çözülmeden dağılım kaydedilemez.
            </Text>
            {conflicts.map((c) => {
              const key = c.date ?? '';
              const res = overrides[key];
              const isEditing = editingConflict === key;
              const dateFmt = key ? key.split('-').reverse().join('.') : '';
              const borderColor = res ? (res.skip ? colors.muted : '#22c55e') : colors.danger;

              return (
                <View key={key} style={[styles.conflictCard, { borderLeftColor: borderColor }]}>
                  {res ? (
                    <View style={styles.conflictRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.conflictDate}>{dateFmt} {c.day_name}</Text>
                        <Text style={styles.conflictMeta}>
                          {res.skip
                            ? '↓ Atlandı — seans sonraki uygun tarihe kayacak'
                            : `✓ ${res.startTime} · ${(staff ?? []).find(s => s.id === res.staffId)?.fullName ?? ''}`}
                        </Text>
                      </View>
                      <Pressable onPress={() => setOverrides(p => { const n = {...p}; delete n[key]; return n; })} hitSlop={6}>
                        <Text style={styles.undoText}>Geri al</Text>
                      </Pressable>
                    </View>
                  ) : isEditing ? (
                    <View style={styles.conflictEditBox}>
                      <Text style={styles.conflictDate}>{dateFmt} {c.day_name}</Text>
                      <View style={styles.conflictEditRow}>
                        <View style={{ flex: 1 }}>
                          <TimeField
                            value={editTime}
                            hourOnly
                            minHour={dayHourRange(c.day_of_week ?? 1).min}
                            maxHour={dayHourRange(c.day_of_week ?? 1).max}
                            onChange={setEditTime}
                          />
                        </View>
                        <View style={{ flex: 2 }}>
                          <SelectField
                            label=""
                            placeholder="Personel seç"
                            value={editStaffId}
                            onChange={(v) => setEditStaffId(typeof v === 'number' ? v : null)}
                            options={(staff ?? []).map((s) => ({ label: s.fullName, value: s.id }))}
                          />
                        </View>
                      </View>
                      <View style={styles.conflictEditActions}>
                        <Button title="Uygula" variant="primary" onPress={() => onConflictApplyEdit(key)} style={styles.conflictBtn} />
                        <Button title="İptal" variant="ghost" onPress={() => setEditingConflict(null)} style={styles.conflictBtn} />
                      </View>
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.conflictDate}>{dateFmt} {c.day_name}</Text>
                      <Text style={styles.conflictMeta}>{c.start_time} · {c.staff_name} · {c.reason ?? 'Oda kapasitesi dolu'}</Text>
                      <View style={styles.conflictActions}>
                        <Pressable
                          style={styles.conflictActionBtn}
                          onPress={() => onConflictEdit(key, c.start_time ?? '', c.staff_id ?? null)}
                        >
                          <Text style={styles.conflictActionText}>Düzenle</Text>
                        </Pressable>
                        <Pressable style={[styles.conflictActionBtn, styles.conflictSkipBtn]} onPress={() => onConflictSkip(key)}>
                          <Text style={styles.conflictActionText}>Atla</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            <Text style={[styles.conflictCount, { color: unresolvedCount > 0 ? colors.danger : '#22c55e' }]}>
              {unresolvedCount > 0
                ? `Çözülmemiş: ${unresolvedCount} çakışma`
                : "✓ Tüm çakışmalar çözüldü. Kaydet'e basın."}
            </Text>
            <View style={styles.conflictFooter}>
              <Button title="Vazgeç" variant="ghost" onPress={() => { setConflicts([]); setOverrides({}); }} style={styles.conflictBtn} />
              <Button
                title="Kaydet"
                variant="primary"
                onPress={onConflictSave}
                disabled={unresolvedCount > 0}
                loading={update.isPending}
                style={styles.conflictBtn}
              />
            </View>
          </View>
        ) : null}

        <Button
          title={editingId ? 'Paketi Güncelle' : 'Paketi Tanımla'}
          variant="primary"
          onPress={onSave}
          loading={create.isPending || update.isPending}
          disabled={(!editingId && hasActive) || conflicts.length > 0}
        />
      </Card> : null}
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors, theme: ResolvedTheme) {
  return StyleSheet.create({
    memberName: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 4 },
    list: { gap: 8, marginBottom: 8 },
    pkgItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: surfaceTint(theme, 0.03),
    },
    pkgLeft: { flex: 1, gap: 2 },
    pkgName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    pkgMeta: { color: colors.muted, fontSize: 12 },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cancelEdit: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    form: { gap: 12, marginBottom: 16 },
    label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateCol: { flex: 1 },
    skipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: surfaceTint(theme, 0.03),
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    skipText: { flex: 1, color: colors.text, fontSize: 13 },
    slots: { gap: 8 },
    dayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: surfaceTint(theme, 0.02),
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    dayCardOn: { borderColor: 'rgba(124,92,255,0.4)', backgroundColor: 'rgba(124,92,255,0.06)' },
    dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    dayName: { color: colors.text, fontSize: 14, fontWeight: '600' },
    dayTime: { width: 80 },
    dayStaff: { flex: 1.4 },

    // Conflict UI
    conflictSection: { gap: 10, marginTop: 4 },
    conflictTitle: { color: '#f59e0b', fontSize: 15, fontWeight: '700' },
    conflictSubtitle: { color: colors.muted, fontSize: 12 },
    conflictCard: {
      borderLeftWidth: 3,
      borderRadius: 8,
      padding: 12,
      backgroundColor: surfaceTint(theme, 0.04),
      gap: 6,
    },
    conflictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    conflictDate: { color: colors.text, fontSize: 14, fontWeight: '600' },
    conflictMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    conflictActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    conflictActionBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: surfaceTint(theme, 0.08),
      borderWidth: 1,
      borderColor: colors.border,
    },
    conflictSkipBtn: { backgroundColor: 'rgba(100,116,139,0.15)' },
    conflictActionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    conflictEditBox: { gap: 8 },
    conflictEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    conflictEditActions: { flexDirection: 'row', gap: 8 },
    conflictCount: { fontSize: 13, fontWeight: '600' },
    conflictFooter: { flexDirection: 'row', gap: 10 },
    conflictBtn: { flex: 1 },
    undoText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  });
}
