import { Alert, Platform } from 'react-native';

/**
 * Admin şifresi sorar (iOS Alert.prompt, secure-text).
 * Vazgeç → null; onay → girilen şifre (boş olabilir).
 * Android: Alert.prompt desteklenmediği için boş döner (backend reddedebilir).
 */
export function promptAdminPassword(
  message = 'Girişi onaylanmış seans üzerinde işlem yapmak için admin şifrenizi girin.',
): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') {
      resolve('');
      return;
    }
    Alert.prompt(
      'Admin şifresi',
      message,
      [
        { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Onayla', onPress: (pwd?: string) => resolve(pwd ?? '') },
      ],
      'secure-text',
    );
  });
}
