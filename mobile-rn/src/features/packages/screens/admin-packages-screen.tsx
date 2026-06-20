import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Badge, Card, ErrorBox, Muted } from '../../../components/ui';
import { Fab } from '../../../components/fab';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { useDeletePackage, usePackages } from '../api/hooks';
import { verifyAdminPassword } from '../../auth/api/auth';

/** Admin paket katalog listesi — ekle/düzenle/sil (web `deletePackage` + `renderPackages` paritesi). */
export function AdminPackagesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = usePackages();
  const del = useDeletePackage();
  const { contentMaxWidth, gutter, columns } = useResponsive();

  function onDelete(id: number, name: string) {
    // Web'deki gibi: önce bilgilendirici onay, sonra admin şifresi
    Alert.alert(
      'Paketi Pasife Al',
      `"${name}" pasife alınacak.\n\nPaket tamamen silinmez; mevcut üye kayıtları korunur, yeni atamalarda görünmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Pasife Al',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Yönetici Onayı',
              'Admin şifrenizi girin:',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Onayla',
                  style: 'destructive',
                  onPress: async (pwd?: string) => {
                    if (!pwd) return;
                    try {
                      await verifyAdminPassword(pwd);
                      del.mutate(id, {
                        onError: (e) => Alert.alert('Hata', (e as Error).message),
                      });
                    } catch {
                      Alert.alert('Hata', 'Şifre hatalı.');
                    }
                  },
                },
              ],
              'secure-text',
            );
          },
        },
      ],
    );
  }

  const refreshBtn = (
    <Pressable onPress={() => refetch()} hitSlop={10} style={styles.refreshBtn}>
      <Ionicons name="refresh" size={20} color={isRefetching ? colors.accent : colors.muted} />
    </Pressable>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Paketler" onBack={() => router.push('/(admin)/more/settings')} right={refreshBtn} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Paketler" onBack={() => router.push('/(admin)/more/settings')} right={refreshBtn} />
      <FlatList
        key={columns}
        data={data ?? []}
        keyExtractor={(p) => String(p.id)}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
        ListEmptyComponent={
          isError
            ? <ErrorBox>{(error as Error)?.message ?? 'Paketler yüklenemedi.'}</ErrorBox>
            : <Card><Muted>Paket yok. Sağa çekerek yenileyin.</Muted></Card>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, columns > 1 ? { flex: 1 } : undefined]}
            onPress={() => router.push({ pathname: '/(admin)/packages/form', params: { id: String(item.id) } })}
          >
            <View style={styles.head}>
              <View style={styles.nameWrap}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Badge label={item.packageType === 'flexible' ? 'Esnek' : 'Sabit'} tone="accent" />
              </View>
              <View style={styles.headActions}>
                <Pressable
                  style={styles.iconBtn}
                  hitSlop={6}
                  onPress={() => router.push({ pathname: '/(admin)/packages/form', params: { id: String(item.id) } })}
                >
                  <Ionicons name="create-outline" size={16} color={colors.muted} />
                </Pressable>
                <Pressable style={styles.iconBtn} hitSlop={6} onPress={() => onDelete(item.id, item.name)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.lessonCount} seans</Text>
              {item.weeklyLessonCount ? <Text style={styles.metaText}>Haftalık {item.weeklyLessonCount}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <Fab onPress={() => router.push('/(admin)/packages/form')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  refreshBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 16, paddingBottom: 96, gap: 10 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  nameWrap: { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
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
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.muted, marginRight: 8 },
});
