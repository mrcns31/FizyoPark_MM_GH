import {
  formatSessionRange,
  formatDayLabel,
  weekdayShort,
  hourOfTs,
  dayOfWeekOfTs,
  toDateStr,
  startOfWeekTs,
  startOfMonthTs,
  endOfMonthTs,
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

describe('startOfWeekTs / startOfMonthTs / endOfMonthTs — cihaz saat dilimine duyarsız olmalı', () => {
  // 7 Haziran 2026 (Pazar) 01:00 Istanbul = 6 Haziran 22:00 UTC.
  // Cihaz UTC veya daha geri bir dilimdeyse, yerel Date aritmetiği bunu 6 Haziran'a düşürürdü.
  const sundayEarlyMorning = Date.UTC(2026, 5, 6, 22, 0, 0);

  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(['Europe/Istanbul', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'])(
    'cihaz tz=%s olsa da Istanbul takvim gününü korur',
    (tz) => {
      process.env.TZ = tz;
      expect(toDateStr(sundayEarlyMorning)).toBe('2026-06-07');
      expect(toDateStr(startOfWeekTs(sundayEarlyMorning))).toBe('2026-06-01'); // o haftanın Pazartesi'si
      expect(toDateStr(startOfMonthTs(sundayEarlyMorning))).toBe('2026-06-01');
      expect(toDateStr(endOfMonthTs(sundayEarlyMorning))).toBe('2026-06-30');
    },
  );
});
