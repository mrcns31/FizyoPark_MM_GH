import { useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';

import { Badge, Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { SheetModal } from '../../../components/sheet-modal';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useFormerMemberPackages, useReactivateMember } from '../api/hooks';
import { searchFormerMembers, type FormerMember, type FormerMemberPackage } from '../api/members';

function fmtDeletedAt(v: string | null): string {
  if (!v) return '–';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '–';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function fmtDate(v: string): string {
  if (!v) return '–';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}
function pkgStatusTone(s: string): 'green' | 'neutral' | 'red' {
  if (s === 'active') return 'green';
  if (s === 'cancelled') return 'red';
  return 'neutral';
}
function pkgStatusLabel(s: string): string {
  if (s === 'active') return 'Aktif';
  if (s === 'completed') return 'Tamamlandı';
  if (s === 'cancelled') return 'İptal';
  return s;
}

/* ── Paket geçmişi sheet ── */
function PackagesSheet({ memberId, memberName, onClose }: { memberId: number | null; memberName: string; onClose: () => void }) {
  const { data, isLoading } = useFormerMemberPackages(memberId);
  const router = useRouter();
  return (
    <SheetModal visible={memberId != null} onClose={onClose}>
      <View style={sheetStyles.container}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.title} numberOfLines={1}>{memberName} — Geçmiş Paketler</Text>
        {isLoading ? <Muted>Yükleniyor…</Muted> : !data || data.length === 0 ? <Muted>Geçmiş paket kaydı yok.</Muted> : (
          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.list}>
            {data.map((pkg: FormerMemberPackage) => (
              <Pressable key={pkg.id} style={sheetStyles.pkgRow} onPress={() => {
                onClose();
                router.push({ pathname: '/(admin)/members/package-sessions', params: { memberPackageId: String(pkg.id), packageName: pkg.packageName, startDate: pkg.startDate, endDate: pkg.endDate, packageStatus: pkg.status, memberId: memberId != null ? String(memberId) : undefined } });
              }}>
                <View style={sheetStyles.pkgLeft}>
                  <Text style={sheetStyles.pkgName}>{pkg.packageName}</Text>
                  <Text style={sheetStyles.pkgMeta}>{fmtDate(pkg.startDate)} – {fmtDate(pkg.endDate)} · {pkg.lessonCount} ders</Text>
                </View>
                <View style={sheetStyles.pkgRight}>
                  <Badge label={pkgStatusLabel(pkg.status)} tone={pkgStatusTone(pkg.status)} />
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Pressable style={sheetStyles.closeBtn} onPress={onClose}>
          <Text style={sheetStyles.closeTxt}>Kapat</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}

/* ── Sonuç kartı (swipe: sağ=paketler, sol=aktif et) ── */
function ResultCard({ m, onPackages, onReactivate }: { m: FormerMember; onPackages: () => void; onReactivate: () => void }) {
  const swipeRef = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <TouchableOpacity style={styles.swipePackages} onPress={() => { swipeRef.current?.close(); onPackages(); }}>
          <Ionicons name="list-outline" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity style={styles.swipeReactivate} onPress={() => { swipeRef.current?.close(); onReactivate(); }}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.swipeText}>Aktif Et</Text>
        </TouchableOpacity>
      )}
    >
      <Pressable style={styles.card} onPress={onPackages}>
        <View style={styles.cardLeft}>
          <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
          <View style={styles.metaRow}>
            {m.memberNo ? <Text style={styles.meta}>No: {m.memberNo}</Text> : null}
            {m.phone ? <Text style={styles.meta}>{m.phone}</Text> : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>İptal: {fmtDeletedAt(m.deletedAt)}</Text>
            {m.packageCount != null ? <Text style={styles.meta}>{m.packageCount} paket</Text> : null}
            {m.sessionCount != null ? <Text style={styles.meta}>{m.sessionCount} seans</Text> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </Swipeable>
  );
}

/** Eski Üyeler — arama tabanlı (Paket Süresi Güncelle mantığı). */
export function FormerMembersScreen() {
  const router = useRouter();
  const reactivate = useReactivateMember();
  const { contentMaxWidth, gutter } = useResponsive();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [results, setResults]     = useState<FormerMember[] | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [pkgSheetId, setPkgSheetId]     = useState<number | null>(null);
  const [pkgSheetName, setPkgSheetName] = useState('');

  const lastNameRef = useRef<TextInput>(null);
  const phoneRef    = useRef<TextInput>(null);

  const wide = { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const, paddingHorizontal: gutter };

  async function onSearch() {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (!name && !phone.trim()) {
      setError('En az ad/soyad veya telefon girin.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await searchFormerMembers({ name: name || undefined, phone: phone.trim() || undefined });
      setResults(res);
      if (res.length === 0) setError('Eski üye bulunamadı.');
    } catch (e) {
      setError((e as Error).message ?? 'Arama başarısız.');
    } finally {
      setLoading(false);
    }
  }

  function onReactivate(id: number, name: string) {
    Alert.alert('Tekrar aktif et', `${name} tekrar aktif edilsin mi?\n\nAynı üye numarası ve paket/seans geçmişi korunur; aktif paketler sonlandırılır.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Aktif Et',
        onPress: () => reactivate.mutate(id, {
          onSuccess: (m) => {
            Alert.alert('Yeniden aktif edildi', `${m.memberNo || name} yeniden aktif edildi.`);
            setResults((prev) => prev?.filter((x) => x.id !== id) ?? prev);
          },
          onError: (e) => Alert.alert('Hata', (e as Error).message),
        }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Eski Üyeler" />

      {/* Arama formu */}
      <View style={[styles.searchBox, wide]}>
        <View style={styles.inputRow}>
          <View style={[styles.inputFlex, styles.inputWrap]}>
            <TextInput style={styles.input} placeholder="Ad" placeholderTextColor={colors.textMuted} value={firstName} onChangeText={setFirstName} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => lastNameRef.current?.focus()} blurOnSubmit={false} />
            {firstName ? <Pressable onPress={() => setFirstName('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <View style={[styles.inputFlex, styles.inputWrap]}>
            <TextInput ref={lastNameRef} style={styles.input} placeholder="Soyad" placeholderTextColor={colors.textMuted} value={lastName} onChangeText={setLastName} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} blurOnSubmit={false} />
            {lastName ? <Pressable onPress={() => setLastName('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <View style={[styles.inputFlex, styles.inputWrap]}>
            <TextInput ref={phoneRef} style={styles.input} placeholder="Telefon" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" returnKeyType="search" onSubmitEditing={onSearch} />
            {phone ? <Pressable onPress={() => setPhone('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
          </View>
          <Pressable style={[styles.getirBtn, loading && styles.getirBtnLoading]} onPress={onSearch} disabled={loading}>
            <Text style={styles.getirText}>{loading ? '…' : 'GETİR'}</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* Sonuçlar */}
      {results && results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={[styles.list, wide]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: m }) => (
            <ResultCard
              m={m}
              onPackages={() => { setPkgSheetId(m.id); setPkgSheetName(m.name); }}
              onReactivate={() => onReactivate(m.id, m.name)}
            />
          )}
        />
      ) : results && results.length === 0 ? null : (
        <View style={[styles.hint, wide]}>
          <Muted>Ad, soyad veya telefon girerek eski üyeyi arayın.</Muted>
        </View>
      )}

      <PackagesSheet memberId={pkgSheetId} memberName={pkgSheetName} onClose={() => setPkgSheetId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchBox: { paddingTop: 12, paddingBottom: 8, gap: 6 },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: {
    flex: 1, height: 42, paddingHorizontal: 10,
    color: colors.text, fontSize: 14,
  },
  inputFlex: { flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  getirBtn: {
    height: 42, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  getirBtnLoading: { opacity: 0.6 },
  getirText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 2 },
  list: { paddingBottom: 24, gap: 8, flexGrow: 1 },
  hint: { paddingTop: 32, alignItems: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.panel,
  },
  cardLeft: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  meta: { fontSize: 12, color: colors.muted },
  swipePackages: {
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    width: 60, borderRadius: 12, marginRight: 4,
  },
  swipeReactivate: {
    backgroundColor: '#2BD576', justifyContent: 'center', alignItems: 'center',
    width: 72, borderRadius: 12, marginLeft: 4, gap: 4,
  },
  swipeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

const sheetStyles = StyleSheet.create({
  container: { backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 14, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  list: { maxHeight: 360 },
  pkgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  pkgLeft: { flex: 1, gap: 3 },
  pkgName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pkgMeta: { color: colors.muted, fontSize: 12 },
  pkgRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtn: { alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  closeTxt: { color: colors.muted, fontSize: 14, fontWeight: '600' },
});
