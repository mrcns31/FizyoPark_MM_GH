import { Alert, Linking } from 'react-native';

/** Kayıtlı telefonu wa.me formatına çevirir: sadece rakam, ülke kodlu (90...). */
export function toWhatsAppNumber(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('90')) return d;
  if (d.startsWith('0')) d = d.slice(1);
  return '90' + d;
}

/** Şifre sıfırlama bildirimini üyeye WhatsApp'tan iletmek için wa.me linkini açar. */
export function sendResetWhatsApp(result: { name?: string; phone?: string; temporaryPassword?: string }) {
  const num = toWhatsAppNumber(result.phone || '');
  if (!num) {
    Alert.alert(
      'Telefon bulunamadı',
      'Bu üyenin kayıtlı telefon numarası olmadığı için WhatsApp mesajı hazırlanamadı. Geçici şifreyi elle iletin.'
    );
    return;
  }
  const greeting = result.name ? `Merhaba ${result.name}` : 'Merhaba';
  const msg =
    `${greeting}, FizyoPark uygulama şifreniz sıfırlandı. Geçici şifreniz: ${result.temporaryPassword}. ` +
    `Girmeden önce telefonunuzdaki eski kayıtlı şifreyi silmeniz gerekmektedir, sonra geçici şifre ile girip yeni şifrenizi belirleyebilirsiniz 🙏`;
  Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`).catch(() => {
    Alert.alert('WhatsApp açılamadı', 'WhatsApp uygulaması açılamadı. Geçici şifreyi elle iletin.');
  });
}
