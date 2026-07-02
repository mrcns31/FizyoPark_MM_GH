import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '../../../components/screen-container';
import { DateField } from '../../../components/date-field';
import { FormField } from '../../../components/form';
import { Button, Card, ErrorBox, Label, Muted, SectionTitle } from '../../../components/ui';
import { ApiError } from '../../../lib/api-client';
import { colors } from '../../../theme/colors';
import {
  useClosurePeriods,
  useCreateClosurePeriod,
  useDeleteClosurePeriod,
} from '../api/hooks';
import type { ClosureSummary } from '../api/closure';

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(
    n.getDate(),
  ).padStart(2, '0')}`;
}
function labelTR(v: string): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}-${m}-${y}`;
}
function summaryText(s: ClosureSummary): string {
  return (
    `${s.dayCount} günlük kapanış kaydedildi. ` +
    `${s.extendedPackageCount} aktif paketin süresi ${s.dayCount} gün uzatıldı, ` +
    `${s.rescheduledCount} seans ileri tarihe alındı` +
    (s.cancelledOnlyCount > 0
      ? `, ${s.cancelledOnlyCount} seans yeniden planlanamadığı için sadece iptal edildi.`
      : '.')
  );
}

/**
 * Kapalı Günler (admin) — web admin-hub "closure-days" paneliyle birebir.
 * Tarih aralığı + açıklama → kapanış kaydı; aralıktaki seanslar ileri alınır, paketler uzatılır.
 */
export function ClosureDaysScreen() {
  const router = useRouter();
  const { data: periods } = useClosurePeriods();
  const create = useCreateClosurePeriod();
  const del = useDeleteClosurePeriod();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const today = todayStr();

  function doSave() {
    setError(null);
    setSummary(null);
    const s = startDate.trim();
    const e = endDate.trim();
    const desc = description.trim();

    if (!s || !e || !desc) {
      setError('Tüm alanları doldurun.');
      return;
    }
    if (e < s) {
      setError('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }
    if (s < today) {
      setError('Geçmiş tarihli kapanış girilemez.');
      return;
    }

    Alert.alert(
      'Kapanış kaydı',
      `${labelTR(s)} – ${labelTR(e)} (${desc}) tarih aralığını kapanış günü olarak kaydetmek istediğinize emin misiniz? ` +
        'Bu aralıktaki seanslar otomatik olarak ileri tarihe alınacak ve tüm aktif üyelerin paket süresi uzatılacaktır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaydet',
          onPress: () =>
            create.mutate(
              { startDate: s, endDate: e, description: desc },
              {
                onSuccess: (res) => {
                  setSummary(summaryText(res.summary));
                  setStartDate('');
                  setEndDate('');
                  setDescription('');
                },
                onError: (err) =>
                  setError(err instanceof ApiError ? err.message : 'Kapanış kaydedilemedi.'),
              },
            ),
        },
      ],
    );
  }

  function onDelete(id: number) {
    Alert.alert(
      'Kapanış kaydını sil',
      'Bu kapanış kaydını silmek istediğinize emin misiniz? Daha önce yapılan seans kaydırma ve paket uzatma işlemleri geri alınmaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () =>
            del.mutate(id, { onError: (e) => Alert.alert('Hata', (e as Error).message) }),
        },
      ],
    );
  }

  return (
    <ScreenContainer title="Kapalı Günler" onBack={() => router.push('/(admin)/more/settings')} scroll>
      <Muted>
        Bayram tatili, resmi tatil veya merkez kaynaklı kapanışlar için tarih aralığı girin. Bu
        aralıktaki seanslar otomatik olarak ileri tarihe alınır ve tüm aktif üyelerin paket süresi
        bu kadar gün uzatılır.
      </Muted>

      <Card style={styles.form}>
        <View>
          <Label>Tatil Başlangıç Tarihi</Label>
          <DateField value={startDate} onChange={setStartDate} minimumDate={new Date()} />
        </View>
        <View>
          <Label>Tatil Bitiş Tarihi</Label>
          <DateField value={endDate} onChange={setEndDate} minimumDate={new Date()} />
        </View>
        <FormField
          label="Açıklama"
          value={description}
          onChangeText={setDescription}
          placeholder="Örn. Kurban Bayramı Tatili"
        />

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {summary ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        ) : null}

        <Button title="Kaydet" variant="primary" onPress={doSave} loading={create.isPending} />
      </Card>

      <SectionTitle>Geçmiş Kayıtlar</SectionTitle>
      <View style={styles.list}>
        {(periods ?? []).length === 0 ? (
          <Card>
            <Muted>Kayıt yok.</Muted>
          </Card>
        ) : null}
        {(periods ?? []).map((cp) => (
          <View key={cp.id} style={styles.item}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemTitle}>
                {labelTR(cp.startDate)} – {labelTR(cp.endDate)}
              </Text>
              {cp.description ? <Text style={styles.itemMeta}>{cp.description}</Text> : null}
            </View>
            <Pressable style={styles.delBtn} hitSlop={6} onPress={() => onDelete(cp.id)}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12, marginTop: 8 },
  summary: {
    backgroundColor: 'rgba(43,213,118,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43,213,118,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  summaryText: { color: 'rgba(216,255,232,0.96)', fontSize: 13 },
  list: { gap: 10, marginTop: 4, marginBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  itemLeft: { flexShrink: 1, gap: 2 },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemMeta: { color: colors.muted, fontSize: 12 },
  delBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
