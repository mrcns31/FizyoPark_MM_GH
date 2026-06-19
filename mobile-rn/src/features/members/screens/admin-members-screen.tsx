import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AlphaFilter, nameStartsWithLetter } from '../../../components/alpha-filter';
import { Card, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useIncremental } from '../../../lib/use-incremental';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useDeleteMember, useMembers } from '../api/hooks';

/** Admin üye listesi — arama + A-Z harf filtresi, ekle/düzenle/sil. */
export function AdminMembersScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMembers();
  const del = useDeleteMember();
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const { contentMaxWidth, gutter, columns } = useResponsive();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = data ?? [];
    if (term) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.phone.includes(term) ||
          m.memberNo.toLowerCase().includes(term)
      );
    }
    if (letter) list = list.filter((m) => nameStartsWithLetter(m.name, letter));
    return list;
  }, [data, q, letter]);

  const { visible, hasMore, loadMore } = useIncremental(filtered, {
    step: 25,
    resetKey: `${q}|${letter ?? ''}`,
  });

  function promptPassword(id: number, name: string, deleteHistory: boolean) {
    Alert.prompt(
      'Admin şifresi',
      `${name}${deleteHistory ? ' geçmişiyle birlikte' : ''} silinecek. Onaylamak için admin şifresini girin:`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: (adminPassword?: string) =>
            del.mutate(
              { id, adminPassword: adminPassword ?? '', deleteHistory },
              { onError: (e) => Alert.alert('Hata', (e as Error).message) }
            ),
        },
      ],
      'secure-text',
    );
  }

  function onDelete(id: number, name: string) {
    Alert.alert(
      'Üyeyi sil',
      `${name} silinecek. Paket ve seans geçmişi de silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Geçmişi koru', onPress: () => promptPassword(id, name, false) },
        { text: 'Geçmişiyle sil', style: 'destructive', onPress: () => promptPassword(id, name, true) },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Üyeler" />
      <View style={[styles.searchWrap, { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
        <TextInput
          style={styles.search}
          placeholder="Üye ara (isim, telefon, no)"
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
        />
        <AlphaFilter value={letter} onChange={setLetter} />
        <Muted>{filtered.length} üye</Muted>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          key={columns}
          data={visible}
          keyExtractor={(m) => String(m.id)}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
          refreshing={isRefetching}
          onRefresh={refetch}
          onEndReached={() => hasMore && loadMore()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={[
            styles.list,
            { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
          ]}
          ListEmptyComponent={<Card><Muted>Üye bulunamadı.</Muted></Card>}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, columns > 1 ? { flex: 1 } : undefined]}
              onPress={() => router.push({ pathname: '/(admin)/members/form', params: { id: String(item.id) } })}
            >
              <View style={styles.head}>
                <View style={styles.nameWrap}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  {item.deletionRequestedAt ? (
                    <View style={styles.delBadge}>
                      <Text style={styles.delBadgeText}>İptal talebi</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.headActions}>
                  <Pressable
                    style={styles.iconBtn}
                    hitSlop={6}
                    onPress={() => router.push({ pathname: '/(admin)/members/form', params: { id: String(item.id) } })}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.muted} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => onDelete(item.id, item.name)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.meta}>
                <Text style={styles.metaText}>{item.phone || '–'}</Text>
                {item.profession ? <Text style={styles.metaText}>{item.profession}</Text> : null}
              </View>
              {item.memberNo ? (
                <View style={styles.meta}>
                  <Text style={styles.metaText}>No: {item.memberNo}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
      <Fab onPress={() => router.push('/(admin)/members/form')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundTop },
  searchWrap: { paddingVertical: 10, gap: 6 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 11,
    color: colors.text,
    fontSize: 16,
  },
  list: { paddingTop: 8, paddingBottom: 96, gap: 10 },
  // web .list-members-card
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  nameWrap: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 15, fontWeight: '750' as '700', color: colors.text },
  delBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,122,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,122,0.28)',
  },
  delBadgeText: { color: '#ff8a96', fontSize: 11, fontWeight: '700' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // web .list-members-card__meta / __dates
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.muted, marginRight: 8 },
});
