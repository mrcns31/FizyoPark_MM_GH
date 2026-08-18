import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '../../../components/date-field';
import { SelectField } from '../../../components/select-field';
import { SheetModal } from '../../../components/sheet-modal';
import { TimeField } from '../../../components/time-field';
import { Button, ErrorBox } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { replenishMemberPackage, skipReplenish } from '../../member-packages/api/member-packages';
import { useWorkingHours } from '../../settings/api/hooks';
import { useStaff } from '../../staff/api/hooks';
import { useTheme } from '../../theme';
import type { AppColors, ResolvedTheme } from '../../../theme/colors';
import type { DeleteSessionResult } from '../api/sessions';
import { replenishFailSummary } from './messages';

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * A1–A3 mobil karşılığı: seans silindikten sonra telafi sonucunu bildirir, yerleştirilemeyenler
 * için elle yerleştirme sheet'ini açar. Web'deki reportSessionReplenishResult /
 * reportBulkReplenishResults / openReplenishModal üçlüsünün paritesi.
 *
 * Kullanım:
 *   const flow = useReplenishFlow();
 *   await flow.report(result);            // tekil silme
 *   await flow.reportBulk(results);       // grup silme
 *   ...
 *   {flow.modal}
 */
/**
 * Ekranın hemen kapanacağı yerlerde (seans formunda üye çıkarma) kullanılır: modal/kuyruk
 * açmak yerine yalnız bilgilendirir ve elle yerleştirme için nereye bakılacağını söyler.
 */
export async function alertReplenishOutcome(results: (DeleteSessionResult | null | undefined)[]) {
  const list = (results || []).filter(Boolean) as DeleteSessionResult[];
  const failed = list.filter((r) => !r.replenished && r.replenishedReason);
  if (!failed.length) return;
  const detail = failed.length === 1
    ? replenishFailSummary(failed[0])
    : `${failed.length} seans için telafi eklenemedi. Paket bir seans eksik kalacak.`;
  await new Promise<void>((resolve) => {
    Alert.alert(
      'Telafi eklenemedi',
      `${detail}\n\nTelafiyi elle yerleştirmek için paketin seans listesini açın.`,
      [{ text: 'Tamam', onPress: () => resolve() }],
    );
  });
}

export function useReplenishFlow(onPlaced?: () => void) {
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, resolvedTheme), [colors, resolvedTheme]);
  const { data: staff } = useStaff();
  const { data: workingHours } = useWorkingHours();

  const [current, setCurrent] = useState<DeleteSessionResult | null>(null);
  const [queueLabel, setQueueLabel] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [staffId, setStaffId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolveRef = useRef<(() => void) | null>(null);

  const staffOptions = useMemo(
    () => (staff ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`.trim() })),
    [staff],
  );

  /** Seçili günün çalışma saatleri — saat ızgarası bununla sınırlanır. */
  const hourRange = useMemo(() => {
    const day = date ? new Date(`${date}T12:00:00`).getDay() : null;
    const wh = day != null && workingHours ? workingHours[day] : null;
    if (!wh || !wh.enabled) return { min: 0, max: 23 };
    const startH = parseInt(String(wh.start).split(':')[0], 10) || 0;
    const endH = parseInt(String(wh.end).split(':')[0], 10) || 23;
    const endM = parseInt(String(wh.end).split(':')[1] || '0', 10);
    return { min: startH, max: endM > 0 ? endH : Math.max(startH, endH - 1) };
  }, [date, workingHours]);

  const closeModal = useCallback(() => {
    setCurrent(null);
    setError(null);
    setBusy(false);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    if (resolve) resolve();
  }, []);

  /** Telafi eklenemeyen bir sonuç için sheet'i açar; kapanınca resolve olur. */
  const openFor = useCallback(
    (result: DeleteSessionResult, label = '') =>
      new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        const first = (result.replenishCandidates || [])[0];
        setCurrent(result);
        setQueueLabel(label);
        setDate(first?.date || toDateStr(new Date()));
        setTime(first?.start_time || '');
        setStaffId(first?.staff_id ?? null);
        setError(null);
      }),
    [],
  );

  /** Tekil silme sonrası bildirim (A1). Pakete bağlı olmayan seanslarda sessiz kalır. */
  const report = useCallback(
    async (result?: DeleteSessionResult | null) => {
      if (!result) return;
      if (result.replenished) {
        Alert.alert('Telafi eklendi', result.message || 'Seans silindi, paket sonuna telafi seansı eklendi.');
        return;
      }
      if (!result.replenishedReason) return;
      if (result.memberPackageId) {
        await openFor(result);
        return;
      }
      Alert.alert('Telafi eklenemedi', replenishFailSummary(result));
    },
    [openFor],
  );

  /** Grup silme sonrası tek özet, ardından yerleştirilemeyenler sırayla (A3). */
  const reportBulk = useCallback(
    async (results: (DeleteSessionResult | null | undefined)[]) => {
      const list = (results || []).filter(Boolean) as DeleteSessionResult[];
      if (!list.length) return;
      if (list.length === 1) {
        await report(list[0]);
        return;
      }
      const placed = list.filter((r) => r.replenished).length;
      const failed = list.filter((r) => !r.replenished && r.replenishedReason);
      const fixable = failed.filter((r) => r.memberPackageId);
      const unfixable = failed.length - fixable.length;

      let msg = `${list.length} seans silindi.`;
      if (placed) msg += `\n${placed} telafi seansı paket sonuna eklendi.`;
      if (fixable.length) msg += `\n${fixable.length} telafi yerleştirilemedi — sırayla düzeltebilirsiniz.`;
      if (unfixable) msg += `\n${unfixable} seans için telafi eklenemedi (paket bulunamadı).`;

      await new Promise<void>((resolve) => {
        Alert.alert(failed.length ? 'Telafi eksik kaldı' : 'Seanslar silindi', msg, [
          { text: 'Tamam', onPress: () => resolve() },
        ]);
      });

      for (let i = 0; i < fixable.length; i++) {
        await openFor(fixable[i], fixable.length > 1 ? `(${i + 1}/${fixable.length})` : '');
      }
    },
    [openFor, report],
  );

  async function submit() {
    if (!current?.memberPackageId) return;
    if (!date || !time || staffId == null) {
      setError('Tarih, saat ve personel seçilmeli.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await replenishMemberPackage(current.memberPackageId, {
        date,
        start_time: time,
        staff_id: staffId,
      });
      closeModal();
      onPlaced?.();
      Alert.alert('Telafi eklendi', res?.message || 'Telafi seansı eklendi.');
    } catch (e) {
      const apiErr = e as ApiError & { data?: { error?: string; conflicts?: { reason_label?: string }[] } };
      const detail = apiErr?.data?.conflicts?.[0]?.reason_label;
      const base = apiErr?.data?.error || apiErr?.message || 'Yerleştirilemedi';
      setError(detail && detail !== base ? `${base}\n(${detail})` : base);
    } finally {
      setBusy(false);
    }
  }

  /** B4 — telafisiz bırakma kararı activity log'a yazılır; hata akışı durdurmaz. */
  function skip() {
    if (current?.memberPackageId) {
      skipReplenish(current.memberPackageId, {
        session_start_ts: current.deletedSession?.startTs ?? null,
        reason: current.replenishedReason ?? null,
      }).catch(() => {});
    }
    closeModal();
  }

  const modal = (
    <SheetModal visible={!!current} onClose={skip}>
      <View style={styles.sheet}>
        <Text style={styles.title}>⚠️ Telafi seansı yerleştirilemedi {queueLabel}</Text>
        <ScrollView style={styles.infoWrap} contentContainerStyle={styles.infoContent}>
          <Text style={styles.info}>{current ? replenishFailSummary(current) : ''}</Text>
        </ScrollView>

        <Text style={styles.formTitle}>Telafiyi elle yerleştir</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Tarih</Text>
          <DateField value={date} onChange={setDate} minimumDate={new Date()} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Saat</Text>
          <TimeField value={time} onChange={setTime} hourOnly minHour={hourRange.min} maxHour={hourRange.max} />
        </View>
        <SelectField
          label="Personel"
          options={staffOptions}
          value={staffId}
          onChange={setStaffId}
          searchable
        />

        {error ? <ErrorBox>{error}</ErrorBox> : null}

        <View style={styles.actions}>
          <Button title="Telafisiz bırak" variant="ghost" onPress={skip} style={styles.actionBtn} />
          <Button title="Yerleştir" variant="primary" onPress={submit} loading={busy} style={styles.actionBtn} />
        </View>
      </View>
    </SheetModal>
  );

  return { report, reportBulk, modal };
}

function makeStyles(colors: AppColors, _theme: ResolvedTheme) {
  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.modalBg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      paddingBottom: 28,
      gap: 10,
    },
    title: { fontSize: 16, fontWeight: '700', color: colors.text },
    infoWrap: { maxHeight: 170 },
    infoContent: { paddingRight: 4 },
    info: { fontSize: 13, lineHeight: 19, color: colors.muted },
    formTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    field: { gap: 4 },
    label: { fontSize: 12, fontWeight: '600', color: colors.muted },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    actionBtn: { flex: 1 },
  });
}
