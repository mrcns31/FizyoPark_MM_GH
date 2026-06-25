import {
  dayEndMs,
  dayStartMs,
  getStaffShiftEndTs,
  loadGlobalWorkingHours,
  localDateStrFromTs,
  parseStaffWorkingHours,
  resolveLocalDateRangeMs,
} from './staffWorkingHours.js';
import { autoCompletePackageIfExhausted, isSessionCancelled } from './packageSessionCounts.js';

const ATTENDANCE_TYPE_SHIFT_REMINDER = 'attendance_pending_shift_end';

async function sendExpoPush(db, userId, title, body) {
  try {
    const { rows } = await db.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
    if (!rows.length) return;
    const messages = rows.map((r) => ({
      to: r.token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      channelId: 'fizyopark',
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // push hatası bildirimi engellemesin
  }
}

/** Yönetici manuel girişi (VARCHAR(10) uyumlu; eski manual_admin de okunur) */
export function isAdminCheckInMethod(method) {
  return method === 'admin' || method === 'manual_admin';
}

function resolveMethod(row) {
  return row.check_in_method ?? row.checkInMethod ?? null;
}

const ATTENDANCE_JOIN_SQL = `
  LEFT JOIN users cu ON cu.id = s.attendance_confirmed_by
  LEFT JOIN staff cs ON cs.user_id = cu.id
`;

export { ATTENDANCE_JOIN_SQL };

/** Giriş/onay kaydı olan seans (gelecek randevular hariç). */
export function isSessionAttendanceConfirmed(row, now = Date.now()) {
  const startTs = Number(row.start_ts ?? row.startTs);
  if (startTs > now) return false;
  const checkedIn = row.checked_in_at ?? row.checkedInAt ?? null;
  const confirmedAt = row.attendance_confirmed_at ?? row.attendanceConfirmedAt ?? null;
  return checkedIn != null || confirmedAt != null;
}

/** Onay etiketi: Yönetici - Geldi / Personel Adı - Geldi / QR / Gelmedi */
export function buildAttendanceLabel(row, now = Date.now()) {
  const method = resolveMethod(row);
  const outcome = row.attendance_outcome ?? row.attendanceOutcome ?? null;
  const checkedIn = row.checked_in_at ?? row.checkedInAt ?? null;
  const confirmerStaffName = (
    row.confirmer_staff_name ??
    row.confirmerStaffName ??
    (row.confirmer_first_name || row.confirmer_last_name
      ? `${row.confirmer_first_name || ''} ${row.confirmer_last_name || ''}`.trim()
      : '')
  ).trim();
  const confirmerRole = row.confirmer_role ?? row.confirmerRole ?? null;

  if (checkedIn && method === 'phone') return 'Telefon - Geldi';
  if (checkedIn && method === 'card') return 'Kart - Geldi';
  if (checkedIn && method === 'qr') return 'QR - Geldi';
  if (checkedIn && isAdminCheckInMethod(method)) return 'Yönetici - Geldi';
  if (checkedIn && method === 'manual') {
    const name = confirmerStaffName || 'Personel';
    return `${name} - Geldi`;
  }
  if (outcome === 'no_show') {
    if (confirmerRole === 'admin' || confirmerRole === 'manager') return 'Yönetici - Gelmedi';
    if (confirmerStaffName) return `${confirmerStaffName} - Gelmedi`;
    return 'Gelmedi';
  }
  const startTs = Number(row.start_ts ?? row.startTs);
  if (startTs > now) return 'Planlandı';
  if (!checkedIn && !(row.attendance_confirmed_at ?? row.attendanceConfirmedAt)) {
    return 'Onaylanmadı';
  }
  return '—';
}

/** Admin paket seans listesi: onay türü + giriş bilgisi */
export function buildPackageSessionApprovalInfo(row, now = Date.now()) {
  if (row.deleted_at != null || isSessionCancelled(row)) {
    return { label: 'İptal edildi', kind: 'cancelled', checkInAt: null };
  }

  const method = resolveMethod(row);
  const checkedInAt = row.checked_in_at ?? row.checkedInAt ?? null;
  const outcome = row.attendance_outcome ?? row.attendanceOutcome ?? null;
  const confirmedAt = row.attendance_confirmed_at ?? row.attendanceConfirmedAt ?? null;
  const confirmerRole = row.confirmer_role ?? row.confirmerRole ?? null;
  const startTs = Number(row.start_ts ?? row.startTs);
  const endTs = Number(row.end_ts ?? row.endTs);

  if (checkedInAt && method === 'phone') {
    return { label: 'Telefon - Geldi', kind: 'phone', checkInAt: checkedInAt };
  }
  if (checkedInAt && method === 'card') {
    return { label: 'Kart - Geldi', kind: 'card', checkInAt: checkedInAt };
  }
  if (checkedInAt && method === 'qr') {
    return { label: 'QR', kind: 'qr', checkInAt: checkedInAt };
  }
  if (outcome === 'no_show' || (confirmedAt && !checkedInAt && method !== 'qr')) {
    const label =
      confirmerRole === 'admin' || confirmerRole === 'manager'
        ? 'Yönetici — Gelmedi'
        : 'Personel — Gelmedi';
    return { label, kind: 'no_show', checkInAt: null };
  }
  if (checkedInAt && isAdminCheckInMethod(method)) {
    return { label: 'Yönetici — Geldi', kind: 'admin_present', checkInAt: checkedInAt };
  }
  if (checkedInAt && method === 'manual') {
    return { label: 'Personel — Geldi', kind: 'staff_present', checkInAt: checkedInAt };
  }
  if (checkedInAt) {
    return { label: 'Geldi', kind: 'present', checkInAt: checkedInAt };
  }
  if (now > endTs && !checkedInAt && !confirmedAt) {
    return { label: 'Otomatik Düşen Seans', kind: 'burned', checkInAt: null };
  }
  if (startTs > now) {
    return { label: 'Planlandı', kind: 'scheduled', checkInAt: null };
  }
  if (!checkedInAt && !confirmedAt) {
    return { label: 'Onaylanmadı', kind: 'pending', checkInAt: null };
  }
  return { label: '—', kind: 'unknown', checkInAt: null };
}

export function sessionRowToAttendanceDto(row, now = Date.now()) {
  const label = buildAttendanceLabel(row, now);
  const method = resolveMethod(row);
  const checkedIn = row.checked_in_at != null;
  const outcome = row.attendance_outcome ?? null;
  const confirmedAt = row.attendance_confirmed_at != null;
  const confirmerRole = row.confirmer_role ?? row.confirmerRole ?? null;
  const startTs = Number(row.start_ts);

  let statusKind = 'pending';
  if (checkedIn && method === 'phone') {
    statusKind = 'phone';
  } else if (checkedIn && method === 'card') {
    statusKind = 'card';
  } else if (checkedIn && method === 'qr') {
    statusKind = 'qr';
  } else if (outcome === 'no_show' || (confirmedAt && !checkedIn && method !== 'qr' && method !== 'phone' && method !== 'card')) {
    statusKind = 'no_show';
  } else if (checkedIn && isAdminCheckInMethod(method)) {
    statusKind = 'admin_present';
  } else if (checkedIn && method === 'manual') {
    statusKind = 'staff_present';
  } else if (checkedIn && confirmedAt) {
    statusKind =
      confirmerRole === 'admin' || confirmerRole === 'manager' ? 'admin_present' : 'staff_present';
  } else if (startTs > now) {
    statusKind = 'scheduled';
  }

  const isConfirmed = statusKind !== 'pending' && statusKind !== 'scheduled';

  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name || '',
    staffId: row.staff_id,
    staffName: row.staff_name || '',
    startTs,
    endTs: Number(row.end_ts),
    roomName: row.room_name || '',
    checkedInAt: row.checked_in_at,
    checkInMethod: method,
    attendanceOutcome: outcome,
    attendanceConfirmedAt: row.attendance_confirmed_at,
    confirmerRole,
    attendanceLabel: label,
    statusKind,
    isConfirmed,
    canStaffApprove:
      !checkedIn &&
      outcome !== 'no_show' &&
      !confirmedAt &&
      startTs <= now,
    canAdminApprove: !isConfirmed && method !== 'qr' && method !== 'phone' && method !== 'card' && startTs <= now,
    canAdminEdit: isConfirmed && method !== 'qr' && method !== 'phone' && method !== 'card' && statusKind !== 'qr' && statusKind !== 'phone' && statusKind !== 'card',
    canAdminOverride: method !== 'qr' && method !== 'phone' && method !== 'card',
  };
}

/** Seans başlangıcından itibaren personel onay verebilir (16:00 kuralı). */
export function canStaffApproveNow(session, now = Date.now()) {
  return Number(session.start_ts) <= now;
}

/** QR okutmuş veya zaten onaylanmış seans personel listesine girmez. */
export function needsStaffAttendanceApproval(row) {
  if (row.deleted_at != null) return false;
  if (row.member_id == null) return false;
  if (row.checked_in_at != null) return false;
  if (row.attendance_confirmed_at != null) return false;
  return true;
}

function sessionRowToPendingDto(row, now = Date.now()) {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name || '',
    staffId: row.staff_id,
    staffName: row.staff_name || '',
    startTs: Number(row.start_ts),
    endTs: Number(row.end_ts),
    roomName: row.room_name || '',
    canApprove: canStaffApproveNow(row, now),
    approveBlockedReason: canStaffApproveNow(row, now)
      ? null
      : 'Seans saati gelmeden onay verilemez',
  };
}

/**
 * Personelin belirli günkü QR'siz, onaysız seansları.
 * @param {object} db
 * @param {{ staffId?: number, dateStr?: string, now?: number }} opts
 */
export async function listPendingAttendanceSessions(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const dateStr = opts.dateStr ?? localDateStrFromTs(now);
  const dayStart = dayStartMs(dateStr);
  const dayEnd = dayEndMs(dateStr);

  const params = [dayStart, dayEnd];
  let staffFilter = '';
  if (opts.staffId != null) {
    staffFilter = ' AND s.staff_id = $3';
    params.push(opts.staffId);
  }

  const res = await db.query(
    `SELECT s.*,
            m.name AS member_name,
            st.first_name || ' ' || st.last_name AS staff_name,
            r.name AS room_name
     FROM sessions s
     LEFT JOIN members m ON m.id = s.member_id
     LEFT JOIN staff st ON st.id = s.staff_id
     LEFT JOIN rooms r ON r.id = s.room_id
     WHERE s.deleted_at IS NULL
       AND s.member_id IS NOT NULL
       AND s.checked_in_at IS NULL
       AND s.attendance_confirmed_at IS NULL
       AND s.start_ts >= $1 AND s.start_ts <= $2
       ${staffFilter}
     ORDER BY s.start_ts ASC`,
    params
  );

  return res.rows
    .filter(needsStaffAttendanceApproval)
    .map((row) => sessionRowToPendingDto(row, now));
}

/**
 * Personel / yönetim onayı: yalnızca QR okutmayan seanslar (QR hariç).
 * @param {'present'|'no_show'} action
 * @param {{ now?: number, role?: string, allowOverride?: boolean }} opts
 */
export async function confirmSessionAttendance(db, sessionId, userId, action, opts = {}) {
  const now = opts.now ?? Date.now();
  const role = opts.role ?? 'staff';
  const allowOverride = !!opts.allowOverride;
  const isAdmin = role === 'admin' || role === 'manager';

  if (action !== 'present' && action !== 'no_show') {
    return { ok: false, status: 400, error: 'Geçersiz işlem' };
  }

  const existing = await db.query(
    `SELECT s.*, mp.status AS package_status
     FROM sessions s
     LEFT JOIN member_packages mp ON mp.id = s.member_package_id
     WHERE s.id = $1`,
    [sessionId]
  );
  if (existing.rows.length === 0 || existing.rows[0].deleted_at != null) {
    return { ok: false, status: 404, error: 'Seans bulunamadı' };
  }

  const session = existing.rows[0];

  const PHYSICAL_METHODS = ['qr', 'phone', 'card'];
  const hasPhysicalEntry = session.checked_in_at != null && PHYSICAL_METHODS.includes(session.check_in_method);

  // Fiziksel giriş (QR/TELEFON/KART) her zaman önceliklidir — personel/admin onayı üzerine yazamaz
  if (hasPhysicalEntry) {
    if (action === 'no_show') {
      return {
        ok: false,
        status: 409,
        error: `Bu üye ${session.check_in_method === 'qr' ? 'QR' : session.check_in_method === 'phone' ? 'telefon' : 'kart'} ile giriş yapmış; gelmedi olarak işaretlenemez.`,
      };
    }
    // action === 'present': fiziksel giriş verisini koru, sadece onay kaydını ekle
    if (session.attendance_confirmed_at != null && !allowOverride) {
      return { ok: false, status: 409, error: 'Bu seans için zaten onay verilmiş' };
    }
    await db.query(
      `UPDATE sessions
       SET attendance_outcome = 'present',
           attendance_confirmed_at = CURRENT_TIMESTAMP,
           attendance_confirmed_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId, userId]
    );
  } else {
    if (session.attendance_confirmed_at != null && !allowOverride) {
      return { ok: false, status: 409, error: 'Bu seans için zaten onay verilmiş' };
    }
    if (!isAdmin && !canStaffApproveNow(session, now)) {
      return {
        ok: false,
        status: 400,
        error: 'Seans saati gelmeden onay verilemez',
      };
    }

    const presentMethod = isAdmin ? 'admin' : 'manual';

    if (action === 'present') {
      await db.query(
        `UPDATE sessions
         SET checked_in_at = CURRENT_TIMESTAMP,
             check_in_method = $3,
             attendance_outcome = 'present',
             attendance_confirmed_at = CURRENT_TIMESTAMP,
             attendance_confirmed_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sessionId, userId, presentMethod]
      );
    } else {
      await db.query(
        `UPDATE sessions
         SET checked_in_at = NULL,
             check_in_method = NULL,
             attendance_outcome = 'no_show',
             attendance_confirmed_at = CURRENT_TIMESTAMP,
             attendance_confirmed_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [sessionId, userId]
      );
    }
  }

  await autoCompletePackageIfExhausted(db, session.member_package_id);

  const updated = await db.query(
    `SELECT s.*,
            cs.first_name AS confirmer_first_name,
            cs.last_name AS confirmer_last_name,
            cu.role AS confirmer_role
     FROM sessions s
     ${ATTENDANCE_JOIN_SQL}
     WHERE s.id = $1`,
    [sessionId]
  );
  const row = updated.rows[0];
  return {
    ok: true,
    session: row,
    action,
    attendanceLabel: buildAttendanceLabel(row, now),
  };
}

/** Admin giriş listesi: tarih aralığındaki tüm üye seansları ve durumları */
export async function listAttendanceEntryList(db, opts = {}) {
  const now = opts.now ?? Date.now();
  const { start, end } = resolveLocalDateRangeMs(opts);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  const params = [start, end];
  let staffFilter = '';
  if (opts.staffId != null) {
    staffFilter = ' AND s.staff_id = $3';
    params.push(opts.staffId);
  }

  const res = await db.query(
    `SELECT s.*,
            m.name AS member_name,
            st.first_name || ' ' || st.last_name AS staff_name,
            r.name AS room_name,
            cs.first_name AS confirmer_first_name,
            cs.last_name AS confirmer_last_name,
            cu.role AS confirmer_role
     FROM sessions s
     LEFT JOIN members m ON m.id = s.member_id
     LEFT JOIN staff st ON st.id = s.staff_id
     LEFT JOIN rooms r ON r.id = s.room_id
     ${ATTENDANCE_JOIN_SQL}
     WHERE s.deleted_at IS NULL
       AND s.member_id IS NOT NULL
       AND s.start_ts >= $1 AND s.start_ts <= $2
       ${staffFilter}
     ORDER BY s.start_ts ASC, m.name ASC`,
    params
  );

  return res.rows.map((row) => sessionRowToAttendanceDto(row, now));
}

async function hasShiftReminderToday(db, userId, dateStr) {
  const r = await db.query(
    `SELECT id FROM staff_notifications
     WHERE user_id = $1 AND type = $2
       AND payload->>'date' = $3
       AND created_at >= CURRENT_DATE
     LIMIT 1`,
    [userId, ATTENDANCE_TYPE_SHIFT_REMINDER, dateStr]
  );
  return r.rows.length > 0;
}

async function createShiftReminderNotification(db, userId, dateStr, pendingCount) {
  const title = 'Onay bekleyen seanslar';
  const body = `${dateStr} tarihinde ${pendingCount} seans için geldi/gelmedi onayı verilmedi. Lütfen giriş onaylarını tamamlayın.`;
  await db.query(
    `INSERT INTO staff_notifications (user_id, type, title, body, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      userId,
      ATTENDANCE_TYPE_SHIFT_REMINDER,
      title,
      body,
      JSON.stringify({ date: dateStr, pendingCount }),
    ]
  );
  await sendExpoPush(db, userId, title, body);
}

/**
 * Mesai bitiminde o günkü onaysız seans varsa personel bildirimi oluşturur (günde bir).
 */
export async function runShiftEndAttendanceReminder(db, staffRow, now = Date.now()) {
  if (!staffRow?.user_id) return { notified: false, reason: 'no_user' };

  const globalWh = await loadGlobalWorkingHours(db);
  const staffWh = parseStaffWorkingHours(staffRow.working_hours);
  const refDate = new Date(now);
  const dayOfWeek = refDate.getDay();
  const dateStr = localDateStrFromTs(now);
  const shiftEndTs = getStaffShiftEndTs(staffWh, dayOfWeek, globalWh, refDate);

  if (shiftEndTs == null || now < shiftEndTs) {
    return { notified: false, reason: 'before_shift_end' };
  }

  const pending = await listPendingAttendanceSessions(db, {
    staffId: staffRow.id,
    dateStr,
    now,
  });
  const actionable = pending.filter((p) => p.canApprove);
  if (actionable.length === 0) {
    return { notified: false, reason: 'no_pending' };
  }

  const already = await hasShiftReminderToday(db, staffRow.user_id, dateStr);
  if (already) {
    return { notified: false, reason: 'already_sent', pendingCount: actionable.length };
  }

  await createShiftReminderNotification(db, staffRow.user_id, dateStr, actionable.length);
  return { notified: true, pendingCount: actionable.length };
}

export async function listStaffNotifications(db, userId, { unreadOnly = false, limit = 30 } = {}) {
  const params = [userId];
  let sql = `SELECT id, type, title, body, payload, read_at, created_at
             FROM staff_notifications WHERE user_id = $1`;
  if (unreadOnly) sql += ' AND read_at IS NULL';
  sql += ' ORDER BY created_at DESC LIMIT $2';
  params.push(limit);
  const r = await db.query(sql, params);
  return r.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    payload: row.payload || {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markStaffNotificationRead(db, userId, notificationId) {
  const r = await db.query(
    `UPDATE staff_notifications SET read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id`,
    [notificationId, userId]
  );
  return r.rows.length > 0;
}

export async function getStaffRowForUser(db, userId) {
  const r = await db.query(
    'SELECT id, user_id, first_name, last_name, working_hours FROM staff WHERE user_id = $1',
    [userId]
  );
  return r.rows[0] ?? null;
}
