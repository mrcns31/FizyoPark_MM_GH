import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoint'leri — telefon / tablet ayrımı.
 * Tablette içerik max genişlikte ortalanır, listeler çok kolona açılır.
 */
export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  /** İçeriğin sığacağı maksimum genişlik (tablette ortalamak için). */
  contentMaxWidth: number;
  /** Kart/grid kolon sayısı. */
  columns: number;
  /** Yatay padding. */
  gutter: number;
}

const TABLET_MIN = 768;

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN;
  const isLandscape = width > height;

  const columns = isTablet ? (isLandscape ? 3 : 2) : 1;
  // Yatay tablette tam genişlik (sola-sağa yayılsın), dikey tablette ortalansın
  const contentMaxWidth = isTablet ? (isLandscape ? width : 720) : width;
  const gutter = isTablet ? (isLandscape ? 16 : 24) : 16;

  return { width, height, isTablet, isLandscape, contentMaxWidth, columns, gutter };
}
