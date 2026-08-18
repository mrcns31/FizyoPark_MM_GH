import { apiClient } from '../../../lib/api-client';

/** Seans (planner/yoklama) — backend /sessions ve /session-attendance. */

export interface PlannerSession {
  id: number;
  staffId: number | null;
  staffName: string;
  memberId: number | null;
  memberName: string;
  roomId: number | null;
  roomName: string;
  startTs: number;
  endTs: number;
  note: string;
  attendanceOutcome: string | null;
  attendanceConfirmedAt: string | null;
  checkedInAt: string | null;
  checkInMethod: string | null;
}

export function plannerSessionFromApi(row: any): PlannerSession {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name || '',
    memberId: row.member_id,
    memberName: row.member_name || '',
    roomId: row.room_id,
    roomName: row.room_name || '',
    startTs: Number(row.start_ts),
    endTs: Number(row.end_ts),
    note: row.note || '',
    attendanceOutcome: row.attendance_outcome || null,
    attendanceConfirmedAt: row.attendance_confirmed_at || null,
    checkedInAt: row.checked_in_at || null,
    checkInMethod: row.check_in_method || null,
  };
}

export interface SessionQuery {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  staffId?: number;
  roomId?: number;
}

export async function getSessions(q: SessionQuery = {}): Promise<PlannerSession[]> {
  const { data } = await apiClient.get('/sessions', { params: q });
  const rows = Array.isArray(data) ? data : (data?.sessions ?? []);
  return rows.map(plannerSessionFromApi);
}

export type AttendanceAction = 'present' | 'no_show';

export async function confirmAttendance(sessionId: number, action: AttendanceAction): Promise<unknown> {
  const { data } = await apiClient.post(`/sessions/attendance/${sessionId}`, { action });
  return data;
}

export interface SessionInput {
  staffId: number;
  memberId: number;
  roomId?: number | null;
  startTs: number;
  endTs: number;
  note?: string;
  memberPackageId?: number | null;
  skipStaffHoursCheck?: boolean;
  skipTrim?: boolean;
}

export async function createSession(input: SessionInput): Promise<unknown> {
  const { data } = await apiClient.post('/sessions', input);
  return data;
}

export async function updateSession(
  id: number,
  input: SessionInput,
  adminPassword?: string,
): Promise<unknown> {
  const body = adminPassword ? { ...input, adminPassword } : input;
  const { data } = await apiClient.put(`/sessions/${id}`, body);
  return data;
}

/** Telafi adayı / çakışma — otomatik telafi ve elle yerleştirme aynı şemayı döner. */
export interface ReplenishCandidate {
  date: string;
  day_name: string;
  day_of_week: number;
  start_time: string;
  staff_id: number | null;
  staff_name: string;
  reason_code: string;
  reason_label: string;
}

export interface ReplenishPlaced {
  start_ts: number;
  date: string;
  day_name: string;
  start_time: string;
  staff_id: number;
  staff_name: string;
}

/**
 * Seans silme yanıtı. Telafi seansı otomatik eklenemediğinde admin bunu görüp elle
 * yerleştirebilsin diye paket ve aday bilgileri de döner (bkz. md/TELAFI_SEANSI_YERLESTIRME_PLANI.md).
 */
export interface DeleteSessionResult {
  message?: string;
  replenished?: boolean;
  replenishedReason?: string | null;
  replenishPlaced?: ReplenishPlaced | null;
  replenishCandidates?: ReplenishCandidate[] | null;
  packageEndDate?: string | null;
  memberPackageId?: number | null;
  deletedSession?: { startTs: number; memberId: number | null; memberName?: string | null; staffId: number | null };
}

export async function deleteSession(id: number, adminPassword?: string): Promise<DeleteSessionResult> {
  const { data } = await apiClient.delete(`/sessions/${id}`, {
    data: adminPassword ? { adminPassword } : {},
  });
  return (data || {}) as DeleteSessionResult;
}

/**
 * Aynı tarih/saatteki iki seansın personelini (ve odasını) tek işlemde takas eder.
 * Seans kayıtları korunur, üyeye bildirim gitmez — bkz. POST /sessions/swap.
 */
export async function swapSessions(
  sessionAId: number,
  sessionBId: number,
  adminPassword?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { sessionAId, sessionBId };
  if (adminPassword) body.adminPassword = adminPassword;
  const { data } = await apiClient.post('/sessions/swap', body);
  return data;
}

export async function moveSessionToPackage(
  sessionId: number,
  targetMpId: number,
  adminPassword?: string,
): Promise<void> {
  const body: Record<string, unknown> = { memberPackageId: targetMpId, skipTrim: true };
  if (adminPassword) body.adminPassword = adminPassword;
  await apiClient.put(`/sessions/${sessionId}`, body);
}

const PHYSICAL_CHECK_IN_METHODS = ['qr', 'phone', 'card'];

/**
 * Web isSessionAttendanceConfirmed paritesi: seans üzerinde değişiklik admin şifresi gerektirir.
 * Fiziksel giriş (QR/Telefon/Kart) varsa seans henüz başlamamış olsa bile kilitlidir —
 * bu sayede giriş yapılmış ama ileri saatli randevu yanlışlıkla silinemiyor.
 */
export function isAttendanceConfirmed(s: PlannerSession, now = Date.now()): boolean {
  if (!s) return false;
  if (s.checkedInAt && s.checkInMethod && PHYSICAL_CHECK_IN_METHODS.includes(s.checkInMethod)) return true;
  if (s.startTs > now) return false;
  return !!(s.checkedInAt || s.attendanceConfirmedAt);
}
