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
  const { data } = await apiClient.post(`/session-attendance/${sessionId}`, { action });
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

export async function deleteSession(id: number, adminPassword?: string): Promise<void> {
  await apiClient.delete(`/sessions/${id}`, { data: adminPassword ? { adminPassword } : {} });
}

/**
 * Web isSessionAttendanceConfirmed paritesi: seans GEÇMİŞTE (startTs ≤ now) ve
 * check-in / yoklama onay damgası varsa, üzerinde değişiklik admin şifresi gerektirir.
 */
export function isAttendanceConfirmed(s: PlannerSession, now = Date.now()): boolean {
  if (!s) return false;
  if (s.startTs > now) return false;
  return !!(s.checkedInAt || s.attendanceConfirmedAt);
}
