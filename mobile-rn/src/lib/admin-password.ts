import { Alert, Platform } from 'react-native';

/**
 * Admin şifresi sorar.
 * iOS  → Alert.prompt (native secure-text)
 * Android → desteklenmez; kullanıcı bilgilendirilir, null döner (işlem iptal)
 *
 * Vazgeç / desteklenmiyor → null
 * Onayla → girilen şifre string'i
 */
export function promptAdminPassword(
  message = 'Bu işlem için admin şifrenizi girin.',
): Promise<string | null> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
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

  // Android'de Alert.prompt desteklenmez — işlem iptal edilir
  return new Promise((resolve) => {
    Alert.alert(
      'Desteklenmiyor',
      'Admin şifre doğrulama bu platformda desteklenmemektedir. Lütfen iOS cihaz kullanın.',
      [{ text: 'Tamam', onPress: () => resolve(null) }],
    );
  });
}
