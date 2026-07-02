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
  checkedInAt: string | null;
  checkInMethod: string | null;
  attendanceLabel: string;
  statusKind: string; // pending | scheduled | no_show | qr | phone | card | admin_present | staff_present
  isConfirmed: boolean;
  canAdminApprove: boolean;
  canAdminEdit: boolean;
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

export async function getEntryList(startDate: string, endDate: string): Promise<EntrySession[]> {
  const { data } = await apiClient.get('/sessions/attendance/entry-list', {
    params: { startDate, endDate },
  });
  return (data?.sessions ?? []) as EntrySession[];
}

export async function getWalkInList(startDate: string, endDate: string): Promise<WalkInEntry[]> {
  const { data } = await apiClient.get('/sessions/attendance/walk-in-list', {
    params: { startDate, endDate },
  });
  return (data?.entries ?? []) as WalkInEntry[];
}

export async function confirmAttendance(
  sessionId: number,
  action: 'present' | 'no_show',
): Promise<void> {
  await apiClient.post(`/sessions/attendance/${sessionId}`, { action });
}
