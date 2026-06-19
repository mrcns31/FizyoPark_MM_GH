import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBox, Muted } from '../../../components/ui';
import { ScreenHeader } from '../../../components/screen-header';
import { WorkingHoursEditor, validateWorkingHours } from '../../../components/working-hours-editor';
import { useResponsive } from '../../../lib/responsive';
import { colors } from '../../../theme/colors';
import { type WorkingHours } from '../api/settings';
import { useUpdateWorkingHours, useWorkingHours } from '../api/hooks';

/**
 * Çalışma Saatleri (admin) — web admin-hub "working-hours" paneliyle birebir.
 * Her gün için aç/kapa + başlangıç–bitiş saati. Seanslar yalnızca bu saatlerde eklenebilir.
 */
export function WorkingHoursScreen() {
  const { data, isLoading } = useWorkingHours();
  const save = useUpdateWorkingHours();
  const { contentMaxWidth, gutter } = useResponsive();

  const [hours, setHours] = useState<WorkingHours>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setHours(data);
  }, [data]);

  function onSave() {
    setError(null);
    const msg = validateWorkingHours(hours);
    if (msg) {
      setError(msg);
      return;
    }
    save.mutate(hours, {
      onSuccess: () => Alert.alert('Kaydedildi', 'Çalışma saatleri güncellendi.'),
      onError: (e) => setError((e as Error).message || 'Çalışma saatleri kaydedilemedi.'),
    });
  }

  const wide = {
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    width: '100%' as const,
    paddingHorizontal: gutter,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Çalışma Saatleri" />
      <ScrollView contentContainerStyle={[styles.content, wide]} showsVerticalScrollIndicator={false}>
        <Muted>
          Her gün için çalışma saatlerini belirleyin. Seanslar sadece bu saatlerde eklenebilir.
        </Muted>

        <WorkingHoursEditor hours={hours} onChange={setHours} />

        {error ? <ErrorBox>{error}</ErrorBox> : null}

        <Button
          title="Kaydet"
          variant="primary"
          onPress={onSave}
          loading={save.isPending}
          disabled={isLoading}
          style={styles.save}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingVertical: 16, gap: 12, flexGrow: 1 },
  save: { marginTop: 4, marginBottom: 8 },
});
