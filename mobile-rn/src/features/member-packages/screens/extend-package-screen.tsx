import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '../../../components/date-field';
import { FormField } from '../../../components/form';
import { Button, Card, ErrorBox, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useMembers } from '../../members/api/hooks';
import { getMemberPackages } from '../api/member-packages';
import { useUpdateMemberPackage } from '../api/hooks';
import type { MemberPackage } from '../../../types/api';

function fmtTR(v: string): string {
  if (!v) return '–';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

/** Paket Süresi Güncelle — üye ara, son paketini bul, bitiş tarihi + durumu güncelle (web `initExtendPackagePanel`). */
export function ExtendPackageScreen() {
  const { data: members } = useMembers();
  const update = useUpdateMemberPackage();
  const { contentMaxWidth, gutter } = useResponsive();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const [pkg, setPkg] = useState<MemberPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'completed'>('active');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q || selected) return [];
    return (members ?? [])
      .filter(
        (m) =>
          m.name.toLocaleLowerCase('tr-TR').includes(q) ||
          m.phone.includes(q) ||
          m.memberNo.toLocaleLowerCase('tr-TR').includes(q),
      )
      .slice(0, 10);
  }, [members, query, selected]);

  async function selectMember(id: number, name: string) {
    setSelected({ id, name });
    setQuery(name);
    setError(null);
    setDone(null);
    setPkg(null);
    setLoadingPkg(true);
    try {
      const pkgs = await getMemberPackages(id);
      const latest = [...pkgs].sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''))[0] ?? null;
      if (!latest) {
        setError('Bu üyenin paketi bulunamadı.');
      } else {
        setPkg(latest);
        setEndDate((latest.endDate || '').slice(0, 10));
        setStatus(latest.status === 'completed' ? 'completed' : 'active');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingPkg(false);
    }
  }

  function reset() {
    setSelected(null);
    setPkg(null);
    setQuery('');
    setEndDate('');
    setError(null);
    setDone(null);
  }

  function onSave() {
    setError(null);
    setDone(null);
    if (!pkg) return;
    if (!endDate) return setError('Bitiş tarihi seçin.');
    update.mutate(
      { id: pkg.id, body: { endDate, status } },
      {
        onSuccess: () => {
          setDone(
            `Güncellendi! Bitiş: ${fmtTR(endDate)} — ${status === 'active' ? 'Aktif' : 'Paketi Bitmiş'}`,
          );
        },
        onError: (e) => setError((e as Error).message || 'Güncellenemedi.'),
      },
    );
  }

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Paket Süresi Güncelle" />
      <ScrollView contentContainerStyle={[styles.content, wide]} showsVerticalScrollIndicator={false}>
        <Muted>Üye adını yazın, son paketini bulun, bitiş tarihini ve durumunu güncelleyin.</Muted>

        <Card style={styles.card}>
          <FormField
            label="Üye ara"
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              if (selected) reset();
            }}
            placeholder="Ad, telefon, üye no"
          />
          {matches.length > 0 ? (
            <View style={styles.dropdown}>
              {matches.map((m) => (
                <Pressable key={m.id} style={styles.dropItem} onPress={() => selectMember(m.id, m.name)}>
                  <Text style={styles.dropName}>{m.name}</Text>
                  <Text style={styles.dropMeta}>
                    {m.memberNo ? `No: ${m.memberNo}` : ''} {m.phone}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {loadingPkg ? <Muted>Paket yükleniyor…</Muted> : null}

          {pkg ? (
            <>
              <View style={styles.pkgInfo}>
                <Text style={styles.pkgName}>{pkg.packageName}</Text>
                <Text style={styles.pkgMeta}>
                  Mevcut bitiş: {fmtTR(pkg.endDate)} · {pkg.lessonCount} ders
                </Text>
              </View>

              <View>
                <Text style={styles.label}>Yeni Bitiş Tarihi</Text>
                <DateField value={endDate} onChange={setEndDate} />
              </View>

              <View>
                <Text style={styles.label}>Durum</Text>
                <View style={styles.statusRow}>
                  {(['active', 'completed'] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.statusBtn, status === s && styles.statusOn]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[styles.statusText, status === s && styles.statusTextOn]}>
                        {s === 'active' ? 'Aktif' : 'Paketi Bitmiş'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error ? <ErrorBox>{error}</ErrorBox> : null}
              {done ? (
                <View style={styles.done}>
                  <Text style={styles.doneText}>{done}</Text>
                </View>
              ) : null}

              <Button title="Kaydet" variant="primary" onPress={onSave} loading={update.isPending} />
            </>
          ) : error && !loadingPkg ? (
            <ErrorBox>{error}</ErrorBox>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: 16, gap: 12, flexGrow: 1 },
  card: { gap: 12 },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dropMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pkgInfo: { gap: 2 },
  pkgName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pkgMeta: { color: colors.muted, fontSize: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  statusText: { color: colors.muted, fontWeight: '700' },
  statusTextOn: { color: colors.text },
  done: {
    backgroundColor: 'rgba(43,213,118,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(43,213,118,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  doneText: { color: 'rgba(216,255,232,0.96)', fontSize: 13 },
});
