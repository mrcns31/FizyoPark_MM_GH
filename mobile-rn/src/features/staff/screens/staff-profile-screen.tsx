import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../../../components/screen-container';
import { BottomSheet } from '../../../components/bottom-sheet';
import { NavRow } from '../../../components/nav-row';
import { Button, Card, Muted } from '../../../components/ui';
import { ChangePasswordForm } from '../../auth/components/change-password-form';
import { MyRatingsCard } from '../../ratings/components/my-ratings-card';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import { useAuth } from '../../auth';

/** Personel profili — hesap bilgisi, puan özeti, şifre değiştir (bottom sheet) ve çıkış. */
export function StaffProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <ScreenContainer scroll title="Profil">
      <Card>
        <Text style={styles.name}>{user?.fullName ?? 'Personel'}</Text>
        {user?.email ? <Muted>{user.email}</Muted> : null}
        <Muted>Rol: Personel</Muted>
      </Card>
      <MyRatingsCard />
      {/* Üç şifre alanı ekranda sürekli açık durmasın — üye profiliyle aynı desen */}
      <NavRow icon="lock-closed-outline" label="Şifre Değiştir" onPress={() => setPwOpen(true)} />
      <Button title="Çıkış Yap" variant="ghost" onPress={signOut} />

      <BottomSheet visible={pwOpen} onClose={() => setPwOpen(false)} title="Şifre Değiştir">
        <ChangePasswordForm bare />
      </BottomSheet>
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    name: { fontSize: 20, fontWeight: '800', color: colors.text },
  });
}
