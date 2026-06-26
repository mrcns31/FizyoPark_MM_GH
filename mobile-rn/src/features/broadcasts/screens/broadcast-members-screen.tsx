import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { useIncremental } from '../../../lib/use-incremental';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useMembers } from '../../members/api/hooks';
import { useMemberPackages } from '../../member-packages/api/hooks';
import { useSendBroadcast } from '../api/hooks';
import type { Member } from '../../../types/api';

type Tab = 'active' | 'passive' | 'all';
const TABS: { key: Tab; label: string }[] = [
  { key: 'active',  label: 'Aktif' },
  { key: 'passive', label: 'Pasif' },
  { key: 'all',     label: 'Hepsi' },
];

// ── Bildirim Yazma Modal ──────────────────────────────────────────────────

function BroadcastModal({
  visible,
  selectedCount,
  sending,
  onSend,
  onClose,
}: {
  visible: boolean;
  selectedCount: number;
  sending: boolean;
  onSend: (title: string, body: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');

  function handleSend() {
    const t = title.trim();
    const b = msgBody.trim();
    if (!t) { Alert.alert('Hata', 'Başlık gerekli'); return; }
    if (!b) { Alert.alert('Hata', 'Mesaj gerekli'); return; }
    onSend(t, b);
  }

  function handleClose() {
    setTitle('');
    setMsgBody('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={modal.overlay} onPress={handleClose} />
      <View style={modal.sheet}>
        <View style={modal.handle} />
        <Text style={modal.heading}>Toplu Bildirim</Text>
        <Text style={modal.sub}>{selectedCount} üye seçili</Text>

        <Text style={modal.label}>Başlık</Text>
        <TextInput
          style={modal.input}
          placeholder="Örn: Merkez Kapalı"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={255}
        />

        <Text style={modal.label}>Mesaj</Text>
        <TextInput
          style={[modal.input, modal.inputMulti]}
          placeholder="Örn: 6–12 Haziran tarihleri arasında merkezimiz kapalıdır."
          placeholderTextColor={colors.muted}
          value={msgBody}
          onChangeText={setMsgBody}
          multiline
          maxLength={1000}
        />

        <View style={modal.actions}>
          <Pressable style={modal.btnCancel} onPress={handleClose} disabled={sending}>
            <Text style={modal.btnCancelText}>Vazgeç</Text>
          </Pressable>
          <Pressable style={[modal.btnSend, sending && { opacity: 0.6 }]} onPress={handleSend} disabled={sending}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Ionicons name="send" size={16} color="#fff" /><Text style={modal.btnSendText}>Gönder</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────────────────

export function BroadcastMembersScreen() {
  const { data: allMembers, isLoading } = useMembers();
  const { data: allPackages } = useMemberPackages();
  const broadcast = useSendBroadcast();
  const { contentMaxWidth, gutter, columns } = useResponsive();

  const [tab, setTab] = useState<Tab>('active');
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);

  // Aktif paket olan üye ID seti
  const activeMemberIds = useMemo(() => {
    const s = new Set<number>();
    for (const mp of allPackages ?? []) {
      if (mp.status === 'active') s.add(mp.memberId);
    }
    return s;
  }, [allPackages]);

  // Tab + arama + harf filtresi
  const filtered = useMemo(() => {
    const all = allMembers ?? [];
    let list: Member[];
    if (tab === 'active')  list = all.filter((m) => activeMemberIds.has(m.id));
    else if (tab === 'passive') list = all.filter((m) => !activeMemberIds.has(m.id));
    else list = all;

    const term = q.trim().toLowerCase();
    if (term) list = list.filter((m) => m.name.toLowerCase().includes(term) || m.phone.includes(term) || m.memberNo.toLowerCase().includes(term));
    if (letter) list = list.filter((m) => nameStartsWithLetter(m.name, letter));
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [allMembers, allPackages, tab, q, letter, activeMemberIds]);

  const { visible, hasMore, loadMore } = useIncremental(filtered, {
    step: 30,
    resetKey: `${tab}|${q}|${letter ?? ''}`,
  });

  // Seçim işlemleri
  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.every((m) => selected.has(m.id))) {
      // hepsi seçiliyse → hepsini kaldır
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      // hepsini seç
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((m) => next.add(m.id));
        return next;
      });
    }
  }

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const someSelected = filtered.some((m) => selected.has(m.id));

  function handleSend(title: string, body: string) {
    broadcast.mutate(
      { memberIds: [...selected], title, body },
      {
        onSuccess: (result) => {
          setShowModal(false);
          setSelected(new Set());
          Alert.alert('Gönderildi', result.message);
        },
        onError: (e) => Alert.alert('Hata', (e as Error).message),
      },
    );
  }

  const wide = {
    paddingHorizontal: gutter,
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
  };

  function renderItem({ item }: { item: Member }) {
    const isSelected = selected.has(item.id);
    const isActive = activeMemberIds.has(item.id);
    return (
      <Pressable
        style={[styles.row, isSelected && styles.rowSelected, columns > 1 && { flex: 1 }]}
        onPress={() => toggle(item.id)}
      >
        <View style={[styles.chk, isSelected && styles.chkOn]}>
          {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          {item.memberNo ? <Text style={styles.rowSub}>No: {item.memberNo}</Text> : null}
        </View>
        <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgePassive]}>
          <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : styles.badgeTextPassive]}>
            {isActive ? 'Aktif' : 'Pasif'}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Bildirim Gönder" />

      <View style={[styles.controls, wide]}>
        {/* Tab seçimi */}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnOn]}
              onPress={() => { setTab(t.key); setSelected(new Set()); }}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Arama */}
        <TextInput
          style={styles.search}
          placeholder="Üye ara (isim, telefon, no)"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
        />
        <AlphaFilter value={letter} onChange={setLetter} />

        {/* Tümünü seç satırı */}
        <Pressable style={styles.selectAllRow} onPress={toggleAll}>
          <View style={[styles.chk, allSelected && styles.chkOn, someSelected && !allSelected && styles.chkIndeterminate]}>
            {allSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : someSelected ? <View style={styles.chkDash} /> : null}
          </View>
          <Text style={styles.selectAllText}>
            {allSelected ? 'Tüm seçimi kaldır' : `Tümünü seç (${filtered.length})`}
          </Text>
          {selected.size > 0 ? (
            <Text style={styles.selCount}>{selected.size} seçili</Text>
          ) : null}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={columns}
          data={visible}
          keyExtractor={(m) => String(m.id)}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.4}
          contentContainerStyle={[styles.list, wide]}
          ListEmptyComponent={<Card><Muted>Üye bulunamadı.</Muted></Card>}
          renderItem={renderItem}
        />
      )}

      {/* Alt bar — seçim varken görünür */}
      {selected.size > 0 ? (
        <View style={[styles.footer, wide]}>
          <Text style={styles.footerCount}>{selected.size} üye seçili</Text>
          <Pressable style={styles.footerBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.footerBtnText}>Bildirim Gönder</Text>
          </Pressable>
        </View>
      ) : null}

      <BroadcastModal
        visible={showModal}
        selectedCount={selected.size}
        sending={broadcast.isPending}
        onSend={handleSend}
        onClose={() => setShowModal(false)}
      />
    </SafeAreaView>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  controls: { paddingTop: 8, gap: 8 },
  tabs: { flexDirection: 'row', gap: 6 },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBtnOn: { backgroundColor: 'rgba(124,92,255,0.20)', borderColor: 'rgba(124,92,255,0.5)' },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: colors.text },
  search: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 10,
    color: colors.text, fontSize: 15,
  },
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  selectAllText: { color: colors.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  selCount: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  list: { paddingTop: 4, paddingBottom: 100, gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowSelected: {
    borderColor: 'rgba(124,92,255,0.6)',
    backgroundColor: 'rgba(124,92,255,0.10)',
  },
  chk: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: colors.muted, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  chkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chkIndeterminate: { borderColor: colors.accent },
  chkDash: { width: 10, height: 2, backgroundColor: colors.accent, borderRadius: 1 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 11, color: colors.muted },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
  badgeActive: { borderColor: 'rgba(46,204,113,0.4)', backgroundColor: 'rgba(46,204,113,0.08)' },
  badgePassive: { borderColor: colors.border, backgroundColor: 'transparent' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextActive: { color: '#2ecc71' },
  badgeTextPassive: { color: colors.muted },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28,
    backgroundColor: '#12121f',
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 12,
  },
  footerCount: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, backgroundColor: colors.accent,
  },
  footerBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

const modal = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36, gap: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 6 },
  heading: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: -4 },
  label: { fontSize: 13, color: colors.muted, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 15,
  },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  btnCancelText: { color: colors.muted, fontWeight: '700' },
  btnSend: {
    flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 12,
    borderRadius: 10, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSendText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
