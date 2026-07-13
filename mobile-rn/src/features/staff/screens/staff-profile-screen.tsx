import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../../../components/screen-container';
import { Button, Card, Muted } from '../../../components/ui';
import { ChangePasswordForm } from '../../auth/components/change-password-form';
import { useTheme } from '../../theme';
import { type AppColors } from '../../../theme/colors';
import { useAuth } from '../../auth';

/** Personel profili — hesap bilgisi ve çıkış. */
export function StaffProfileScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScreenContainer scroll title="Profil">
      <Card>
        <Text style={styles.name}>{user?.fullName ?? 'Personel'}</Text>
        {user?.email ? <Muted>{user.email}</Muted> : null}
        <Muted>Rol: Personel</Muted>
      </Card>
      <ChangePasswordForm />
      <Button title="Çıkış Yap" variant="ghost" onPress={signOut} />
    </ScreenContainer>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    name: { fontSize: 20, fontWeight: '800', color: colors.white },
  });
}
