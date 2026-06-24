import { Alert, Platform } from 'react-native';
import { adminPasswordEmitter } from './admin-password-emitter';

/**
 * Admin şifresi sorar.
 * iOS  → Alert.prompt (native secure-text)
 * Android → custom modal (AdminPasswordModal root'ta tanımlı olmalı)
 *
 * Vazgeç / iptal → null
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

  return new Promise((resolve) => {
    adminPasswordEmitter.request(message, resolve);
  });
}
