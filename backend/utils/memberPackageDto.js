import db from '../config/database.js';
import {
  TWO_HOURS_MS,
  computePackageSessionCounts,
  isSessionCancelled,
  isSessionConsumed,
} from './packageSessionCounts.js';
import {
  buildAttendanceLabel,
  buildPackageSessionApprovalInfo,
} from './sessionAttendance.js';

export const PACKAGE_CANCELLED_LABEL = 'Paket iptal edildi';

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Seans satırı → ortak DTO (üye portal + admin paket seans listesi).
 * @param {object} options.forAdmin — true ise canCancel: false ve approvalLabel/Kind eklenir
 */
export function sessionToDto(row, staffMap, packageType, packageStatus = 'active', options = {}) {
  const forAdmin = options.forAdmin === true;
  const now = Date.now();
  const startTs = Number(row.start_ts);
  const endTs = Number(row.end_ts);
  const cancelled = isSessionCancelled(row);
  const consumed = isSessionConsumed(row, now);
  const checkedIn = row.checked_in_at != null;
  const attendanceOutcome = row.attendance_outcome || null;
  const attendanceLabel = buildAttendanceLabel(row, now);
  const pkgInactive = packageStatus !== 'active';
  const isPast = consumed || (!pkgInactive && startTs <= now);

  if (cancelled) {
    const cancelLabel = pkgInactive ? PACKAGE_CANCELLED_LABEL : 'İptal edildi';
    const dto = {
      id: row.id,
      staffId: row.staff_id,
      staffName: staffMap[row.staff_id]
        ? `${staffMap[row.staff_id].first_name || ''} ${staffMap[row.staff_id].last_name || ''}`.trim()
        : '',
      roomId: row.room_id,
      roomName: row.room_name || '',
      startTs,
      endTs,
      note: row.note || '',
      checkedIn: false,
      isPast: !pkgInactive,
      isCancelled: true,
      isConsumed: false,
      canCancel: false,
      cancelReason: cancelLabel,
      status: 'cancelled',
      statusLabel: cancelLabel,
    };
    if (forAdmin) {
      const approval = buildPackageSessionApprovalInfo(row, now);
      dto.approvalLabel = pkgInactive ? PACKAGE_CANCELLED_LABEL : approval.label;
      dto.approvalKind = approval.kind;
    }
    return dto;
  }

  const isFlexible = packageType === 'flexible';
  let canCancel = false;
  let cancelReason = null;
  let cancelReasonDetail = null;

  if (pkgInactive && !consumed) {
    cancelReason = PACKAGE_CANCELLED_LABEL;
  } else if (consumed) {
    cancelReason = attendanceLabel !== '—' && attendanceLabel !== 'Planlandı' && attendanceLabel !== 'Onay bekliyor'
      ? attendanceLabel
      : (checkedIn ? 'Seans tamamlandı' : 'Seans yapılmış sayılır');
  } else if (startTs < startOfTodayMs()) {
    cancelReason = 'Geçmiş seanslar iptal edilemez';
  } else if (!isFlexible) {
    cancelReason = 'Sabit pakette seans iptali yapılamaz';
  } else if (startTs - now < TWO_HOURS_MS) {
    cancelReason = 'İptal süreniz dolmuştur.';
    cancelReasonDetail = 'Seanslar en geç 2 saat öncesinde iptal edilebilmektedir';
  } else if (!forAdmin) {
    canCancel = true;
  }

  let status = 'scheduled';
  let statusLabel = 'Planlandı';
  if (consumed && checkedIn) {
    status = 'completed';
    statusLabel = attendanceLabel.includes('Geldi') ? attendanceLabel : 'Katılındı';
  } else if (consumed && attendanceOutcome === 'no_show') {
    status = 'completed';
    statusLabel = attendanceLabel.includes('Gelmedi') ? attendanceLabel : 'Gelmedi';
  } else if (consumed) {
    status = 'completed';
    statusLabel = 'Yapıldı';
  } else if (startTs - now < TWO_HOURS_MS && isFlexible) {
    status = 'locked';
    statusLabel = 'İptal edilemez';
  }

  if (pkgInactive && !consumed) {
    status = 'package_cancelled';
    statusLabel = PACKAGE_CANCELLED_LABEL;
    canCancel = false;
  }

  if (forAdmin) {
    canCancel = false;
  }

  const staff = staffMap[row.staff_id];
  const dto = {
    id: row.id,
    staffId: row.staff_id,
    staffName: staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : '',
    roomId: row.room_id,
    roomName: row.room_name || '',
    startTs,
    endTs,
    note: row.note || '',
    checkedIn,
    checkedInAt: row.checked_in_at || null,
    checkInMethod: row.check_in_method || null,
    isPast,
    isConsumed: consumed,
    canCancel,
    cancelReason,
    cancelReasonDetail,
    status,
    statusLabel,
  };

  if (forAdmin) {
    const approval = buildPackageSessionApprovalInfo(row, now);
    if (pkgInactive && !consumed) {
      dto.approvalLabel = PACKAGE_CANCELLED_LABEL;
      dto.approvalKind = 'cancelled';
    } else {
      dto.approvalLabel = approval.label;
      dto.approvalKind = approval.kind;
    }
  }

  return dto;
}

export async function loadStaffMap() {
  const res = await db.query('SELECT id, first_name, last_name FROM staff');
  const map = {};
  for (const row of res.rows) map[row.id] = row;
  return map;
}

/** PostgreSQL DATE → YYYY-MM-DD (JSON'da timezone kayması olmasın) */
export function toDateOnlyString(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export async function buildPackageWithSessions(mpRow, memberId, staffMap) {
  const sessionsRes = await db.query(
    `SELECT s.*, r.name AS room_name
     FROM sessions s
     LEFT JOIN rooms r ON r.id = s.room_id
     WHERE s.member_package_id = $1 AND s.member_id = $2
     ORDER BY s.start_ts ASC`,
    [mpRow.id, memberId]
  );

  const packageType = mpRow.package_type || 'fixed';
  const sessions = sessionsRes.rows.map((s) => sessionToDto(s, staffMap, packageType, mpRow.status));
  const counts = computePackageSessionCounts(sessionsRes.rows, mpRow.lesson_count);

  return {
    id: mpRow.id,
    packageId: mpRow.package_id,
    packageName: mpRow.package_name || '',
    packageType,
    lessonCount: mpRow.lesson_count,
    startDate: toDateOnlyString(mpRow.start_date),
    endDate: toDateOnlyString(mpRow.end_date),
    status: mpRow.status,
    remainingSessions: counts.remainingSessions,
    usedSessions: counts.consumedSessions,
    scheduledFuture: counts.scheduledFuture,
    totalSessions: counts.totalSessions,
    sessions,
  };
}
