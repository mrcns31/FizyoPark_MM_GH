export interface AppColors {
  white: string;
  bg: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  danger: string;
  ok: string;
  fpGreen: string;
  fpOrange: string;
  shadow: string;
  overlay: string;
  tabBarBg: string;
  link: string;
  notification: string;
  modalBg: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  successBg: string;
  successBorder: string;
  successText: string;
  radius: number;
  radius2: number;
  backgroundTop: string;
  backgroundBottom: string;
  green: string;
  greenDark: string;
  greenMuted: string;
  orange: string;
  textSecondary: string;
  textMuted: string;
}

/**
 * Web admin `styles.css` `:root` paletiyle BİREBİR (dark varyant).
 * Primary = mor accent (#7c5cff), her iki temada da sabit (marka tutarlılığı).
 */
const dark: AppColors = {
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

  // Semantic token'lar (ekranlara saçılmış ad-hoc değerlerin karşılığı)
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.6)', // modal/drawer backdrop
  tabBarBg: '#0c1226',
  link: '#8ec5ff',
  notification: '#FFD9A0',
  modalBg: '#1a1a2e',
  errorBg: 'rgba(255,77,109,0.12)',
  errorBorder: 'rgba(255,77,109,0.35)',
  errorText: 'rgba(255,220,226,0.96)',
  successBg: 'rgba(43,213,118,0.12)',
  successBorder: 'rgba(43,213,118,0.35)',
  successText: 'rgba(216,255,232,0.96)',

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
};

const light: AppColors = {
  white: '#FFFFFF',

  bg: '#F5F6FA',
  panel: '#FFFFFF',
  panel2: '#F0F1F6',
  border: 'rgba(11,16,32,0.08)',
  text: '#0B1020',
  muted: 'rgba(11,16,32,0.60)',
  accent: '#7C5CFF',
  accentSoft: 'rgba(124,92,255,0.12)',
  danger: '#FF4D6D',
  ok: '#2BD576',

  fpGreen: '#3DB84A',
  fpOrange: '#FF9500',

  shadow: '#000000',
  overlay: 'rgba(11,16,32,0.35)',
  tabBarBg: '#FFFFFF',
  link: '#2F6FDB',
  notification: '#B8720A',
  modalBg: '#FFFFFF',
  errorBg: 'rgba(255,77,109,0.10)',
  errorBorder: 'rgba(255,77,109,0.35)',
  errorText: '#9F1239',
  successBg: 'rgba(43,213,118,0.10)',
  successBorder: 'rgba(43,213,118,0.35)',
  successText: '#166534',

  radius: 14,
  radius2: 10,

  backgroundTop: '#F5F6FA',
  backgroundBottom: '#F5F6FA',
  green: '#7C5CFF',
  greenDark: '#5B43CC',
  greenMuted: '#9B86FF',
  orange: '#FF9500',
  textSecondary: 'rgba(11,16,32,0.60)',
  textMuted: 'rgba(11,16,32,0.42)',
};

export const palettes = { light, dark } as const;

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Yüzey üstü ince tint (bölücü çizgi, hafif dolgu vb.). Dark'ta beyaz,
 * light'ta koyu lacivert baz alınır — ekranlarda tekrar eden
 * `rgba(255,255,255,X)` desenlerinin theme-aware karşılığı.
 */
export function surfaceTint(theme: ResolvedTheme, opacity: number): string {
  return theme === 'dark' ? `rgba(255,255,255,${opacity})` : `rgba(11,16,32,${opacity})`;
}
