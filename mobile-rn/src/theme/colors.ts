/**
 * Web admin `styles.css` `:root` paletiyle BİREBİR.
 * Primary = mor accent (#7c5cff). Kartlar SOLID panel (#121a33) + ince border.
 */
export const colors = {
  white: '#FFFFFF',

  // Web :root karşılıkları
  bg: '#0B1020', // --bg
  panel: '#121A33', // --panel  (kart arka planı — solid)
  panel2: '#0F1730', // --panel2 (içe gömülü / ikincil yüzey)
  border: 'rgba(255,255,255,0.08)', // --border
  text: '#E8ECFF', // --text
  muted: 'rgba(232,236,255,0.72)', // --muted
  accent: '#7C5CFF', // --accent (PRIMARY — mor)
  accentSoft: 'rgba(124,92,255,0.16)', // accent dolgu/aktif zemin
  danger: '#FF4D6D', // --danger
  ok: '#2BD576', // --ok (başarı yeşili)

  // Marka renkleri (ikincil vurgu)
  fpGreen: '#3DB84A', // --fp-green
  fpOrange: '#FF9500', // --fp-orange

  radius: 14, // --radius
  radius2: 10, // --radius2

  // --- Geriye dönük uyumluluk (eski kod bu anahtarları kullanıyor) ---
  backgroundTop: '#0B1020',
  backgroundBottom: '#0B1020',
  green: '#7C5CFF', // eski "green=primary" referansları artık mor
  greenDark: '#5B43CC',
  greenMuted: '#9B86FF',
  orange: '#FF9500',
  textSecondary: 'rgba(232,236,255,0.72)',
  textMuted: 'rgba(232,236,255,0.50)',
} as const;

export type AppColors = typeof colors;
