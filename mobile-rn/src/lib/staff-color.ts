/**
 * Personele özgü renk — web `app.js` staffColor() ile birebir (HSL paleti).
 * Personel listesi sırasına göre indeks, yoksa ID hash'i.
 */
const STAFF_COLOR_PALETTE: { h: number; s: number }[] = [
  { h: 265, s: 75 }, // mor
  { h: 45, s: 85 }, // amber/sarı
  { h: 165, s: 55 }, // yeşil-turkuaz
  { h: 340, s: 70 }, // pembe-kırmızı
  { h: 195, s: 75 }, // mavi
  { h: 25, s: 90 }, // turuncu
  { h: 290, s: 65 }, // eflatun
  { h: 140, s: 60 }, // yeşil
  { h: 0, s: 70 }, // kırmızı
  { h: 220, s: 70 }, // lacivert
  { h: 50, s: 80 }, // altın
  { h: 180, s: 60 }, // camgöbeği
];

export interface StaffColor {
  border: string;
  bg: string;
  badge: string;
  text: string;
}

/** staffIndex: personel listesindeki sıra (>=0). Yoksa staffId hash'i için -1 ver. */
export function staffColor(staffIndex: number, staffId?: number | string | null): StaffColor {
  let idx = staffIndex;
  if (idx < 0) {
    const id = String(staffId ?? '');
    idx = id.length
      ? [...id].reduce((a, c) => (a * 17 + c.charCodeAt(0)) % STAFF_COLOR_PALETTE.length, 0)
      : 0;
  }
  const { h, s } = STAFF_COLOR_PALETTE[idx % STAFF_COLOR_PALETTE.length];
  return {
    border: `hsla(${h}, ${s}%, 62%, 0.82)`,
    bg: `hsla(${h}, ${s}%, 55%, 0.28)`,
    badge: `hsla(${h}, ${s}%, 70%, 0.22)`,
    text: `hsla(${h}, ${s}%, 82%, 1)`,
  };
}
