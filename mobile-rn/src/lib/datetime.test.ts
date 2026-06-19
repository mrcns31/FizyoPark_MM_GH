import {
  formatSessionRange,
  formatDayLabel,
  weekdayShort,
  hourOfTs,
  dayOfWeekOfTs,
} from './datetime';

// 2026-06-18 (Perşembe) 10:00 -> 11:00, Europe/Istanbul (UTC+3) epoch ms
const start = Date.UTC(2026, 5, 18, 7, 0, 0); // 07:00 UTC = 10:00 TR
const end = Date.UTC(2026, 5, 18, 8, 0, 0); // 11:00 TR

describe('formatSessionRange', () => {
  it('saat aralığını HH:MM - HH:MM verir (Istanbul)', () => {
    expect(formatSessionRange(start, end)).toBe('10:00 - 11:00');
  });
});

describe('formatDayLabel', () => {
  it('gün + ay + yıl etiketi verir', () => {
    expect(formatDayLabel(start)).toBe('18 Haziran 2026');
  });
});

describe('hourOfTs / dayOfWeekOfTs', () => {
  it('Istanbul saatini ve gününü verir (18 Haz 2026 = Perşembe, 10:00)', () => {
    expect(hourOfTs(start)).toBe(10);
    expect(dayOfWeekOfTs(start)).toBe(4); // Perşembe
  });
});

describe('weekdayShort', () => {
  it('0=Pazar ... 6=Cumartesi kısaltma', () => {
    expect(weekdayShort(0)).toBe('Paz');
    expect(weekdayShort(1)).toBe('Pzt');
    expect(weekdayShort(4)).toBe('Per');
    expect(weekdayShort(6)).toBe('Cmt');
  });
});
