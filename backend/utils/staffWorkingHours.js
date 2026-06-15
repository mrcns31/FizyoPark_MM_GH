/** Personel / salon çalışma saatleri — mesai bitişi hesabı */

export function parseStaffWorkingHours(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function timeToMinutes(t) {
  const parts = String(t || '').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export async function loadGlobalWorkingHours(db) {
  const r = await db.query(
    'SELECT day_of_week, enabled, start_time, end_time FROM working_hours ORDER BY day_of_week'
  );
  const map = {};
  for (const row of r.rows) {
    map[row.day_of_week] = row;
  }
  return map;
}

/** Belirli gün için personelin mesai bitiş dakikası (gece yarısından itibaren). */
export function getStaffShiftEndMinutes(staffWh, dayOfWeek, globalWh) {
  const global = globalWh[dayOfWeek];
  if (!global || !global.enabled) return null;

  const dayWh = staffWh[String(dayOfWeek)] ?? staffWh[dayOfWeek];
  if (dayWh && dayWh.enabled === false) return null;

  let endMin = timeToMinutes(global.end_time);
  if (dayWh && dayWh.end) {
    endMin = Math.min(endMin, timeToMinutes(dayWh.end));
  }
  return endMin;
}

/** Yerel tarih için mesai bitiş timestamp (ms). */
export function getStaffShiftEndTs(staffWh, dayOfWeek, globalWh, refDate = new Date()) {
  const endMin = getStaffShiftEndMinutes(staffWh, dayOfWeek, globalWh);
  if (endMin == null) return null;
  const d = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(endMin);
  return d.getTime();
}

export function localDateStrFromTs(ts) {
  const d = new Date(Number(ts));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayStartMs(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getTime();
}

export function dayEndMs(dateStr) {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.getTime();
}

/** startDate / endDate (YYYY-MM-DD) veya tek dateStr → yerel gün aralığı ms */
export function resolveLocalDateRangeMs(opts = {}) {
  const startDateStr = opts.startDateStr ?? opts.startDate ?? opts.dateStr ?? opts.date;
  const endDateStr = opts.endDateStr ?? opts.endDate ?? startDateStr;
  const start = dayStartMs(startDateStr);
  const end = dayEndMs(endDateStr);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { start: NaN, end: NaN, startDateStr: startDateStr || '', endDateStr: endDateStr || '' };
  }
  if (start > end) {
    return { start: dayStartMs(endDateStr), end: dayEndMs(startDateStr), startDateStr: endDateStr, endDateStr: startDateStr };
  }
  return { start, end, startDateStr: String(startDateStr).slice(0, 10), endDateStr: String(endDateStr).slice(0, 10) };
}
