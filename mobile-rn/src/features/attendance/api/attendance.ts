import { apiClient } from '../../../lib/api-client';

/** Giriş listesi / randevusuz girişler (admin) — /sessions/attendance/*. */

export interface EntrySession {
  id: number;
  memberId: number;
  memberName: string;
  staffId: number | null;
  staffName: string;
  startTs: number;
  endTs: number;
  roomName: string;
  checkedInAt: number | null;
  checkInMethod: string | null;
  attendanceLabel: string;
  statusKind: string; // pending | scheduled | no_show | qr | phone | card | admin_present | staff_present
  isConfirmed: boolean;
  canAdminApprove: boolean;
  canAdminOverride: boolean;
}

export interface WalkInEntry {
  id: number;
  accessedAt: number;
  memberId: number | null;
  memberName: string;
  memberNo: string;
  source: string; // qr | phone | card
  label: string;
}

export async function getEntryList(date: string): Promise<EntrySession[]> {
  const { data } = await apiClient.get('/sessions/attendance/entry-list', { params: { date } });
  return (data?.sessions ?? []) as EntrySession[];
}

export async function getWalkInList(date: string): Promise<WalkInEntry[]> {
  const { data } = await apiClient.get('/sessions/attendance/walk-in-list', { params: { date } });
  return (data?.entries ?? []) as WalkInEntry[];
}

export async function confirmAttendance(
  sessionId: number,
  action: 'present' | 'no_show',
): Promise<void> {
  await apiClient.post(`/sessions/attendance/${sessionId}`, { action });
}
