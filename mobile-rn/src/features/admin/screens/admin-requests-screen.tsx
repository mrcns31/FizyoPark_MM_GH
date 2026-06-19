import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Badge, Button, Card, Muted, SectionTitle } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import {
  useApproveDeletion,
  useDeletionRequests,
  useDismissPackageRequest,
  usePackageRequests,
  useRejectDeletion,
} from '../api/hooks';

/** Admin talepler — paket talepleri (kaldır) + üyelik silme talepleri (onay/red). */
export function AdminRequestsScreen() {
  const pkgReqs = usePackageRequests();
  const delReqs = useDeletionRequests();
  const dismiss = useDismissPackageRequest();
  const approve = useApproveDeletion();
  const reject = useRejectDeletion();
  const router = useRouter();
  const { contentMaxWidth, gutter } = useResponsive();

  function confirm(title: string, msg: string, onYes: () => void) {
    Alert.alert(title, msg, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Onayla', onPress: onYes },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Talepler" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        <SectionTitle>Paket talepleri ({pkgReqs.data?.length ?? 0})</SectionTitle>
        {(pkgReqs.data ?? []).length === 0 ? <Muted>Bekleyen paket talebi yok.</Muted> : null}
        {(pkgReqs.data ?? []).map((r) => (
          <Card key={r.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.name}>{r.memberName}</Text>
              <Badge label={r.packageType === 'flexible' ? 'Esnek' : 'Sabit'} tone="neutral" />
            </View>
            <Muted>{r.packageName}</Muted>
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Paket Tanımla"
                  variant="primary"
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/members/member-packages',
                      params: { memberId: String(r.memberId), packageId: String(r.packageId) },
                    })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Talebi kaldır"
                  variant="ghost"
                  loading={dismiss.isPending}
                  onPress={() =>
                    confirm('Talebi kaldır', `${r.memberName} için «${r.packageName}» talebi kaldırılsın mı?`, () =>
                      dismiss.mutate(r.id)
                    )
                  }
                />
              </View>
            </View>
          </Card>
        ))}

        <View style={{ height: 8 }} />
        <SectionTitle>Üyelik silme talepleri ({delReqs.data?.length ?? 0})</SectionTitle>
        {(delReqs.data ?? []).length === 0 ? <Muted>Bekleyen silme talebi yok.</Muted> : null}
        {(delReqs.data ?? []).map((r) => (
          <Card key={r.id}>
            <Text style={styles.name}>{r.memberName}</Text>
            {r.phone ? <Muted>{r.phone}</Muted> : null}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Onayla (sil)"
                  variant="danger"
                  loading={approve.isPending}
                  onPress={() =>
                    confirm('Silmeyi onayla', `${r.memberName} üyeliği silinsin mi?`, () => approve.mutate(r.id))
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reddet"
                  variant="ghost"
                  loading={reject.isPending}
                  onPress={() => reject.mutate(r.id)}
                />
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: 16, gap: 10, flexGrow: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
