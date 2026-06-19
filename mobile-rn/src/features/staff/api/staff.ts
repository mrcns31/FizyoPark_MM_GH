import { apiClient } from '../../../lib/api-client';
import type { WorkingHours } from '../../settings/api/settings';

/** Personel yönetimi (admin) — /staff. Backend create/update camelCase bekler. */

export interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  cardNo: string | null;
  workingHours: WorkingHours;
}

/** Backend working_hours (jsonb obje veya string) → WorkingHours. */
function parseWorkingHours(raw: any): WorkingHours {
  let wh = raw;
  if (typeof wh === 'string') {
    try {
      wh = JSON.parse(wh);
    } catch {
      wh = {};
    }
  }
  const out: WorkingHours = {};
  if (wh && typeof wh === 'object') {
    for (const [k, v] of Object.entries(wh as Record<string, any>)) {
      const day = Number(k);
      if (Number.isNaN(day) || day < 0 || day > 6 || !v) continue;
      out[day] = {
        enabled: !!(v as any).enabled,
        start: (v as any).start || (v as any).start_time || '08:00',
        end: (v as any).end || (v as any).end_time || '20:00',
      };
    }
  }
  return out;
}

function fromApi(row: any): StaffMember {
  const firstName = row.first_name || row.firstName || '';
  const lastName = row.last_name || row.lastName || '';
  return {
    id: row.id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    phone: row.phone || '',
    email: row.user_email || row.email || '',
    cardNo: row.card_no || row.cardNo || null,
    workingHours: parseWorkingHours(row.working_hours ?? row.workingHours),
  };
}

export interface StaffInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  cardNo?: string | null;
  workingHours?: WorkingHours;
}

export async function getStaff(): Promise<StaffMember[]> {
  const { data } = await apiClient.get('/staff');
  return (Array.isArray(data) ? data : []).map(fromApi);
}

export async function createStaff(input: StaffInput): Promise<StaffMember> {
  const { data } = await apiClient.post('/staff', input);
  return fromApi(data);
}

export async function updateStaff(id: number, input: StaffInput): Promise<StaffMember> {
  const { data } = await apiClient.put(`/staff/${id}`, input);
  return fromApi(data);
}

export async function deleteStaff(id: number, adminPassword: string): Promise<void> {
  await apiClient.delete(`/staff/${id}`, { data: { adminPassword } });
}

/** Personelin giriş şifresini sıfırlar; backend geçici şifre döndürebilir. */
export async function resetStaffPassword(id: number): Promise<{ password?: string; tempPassword?: string }> {
  const { data } = await apiClient.post(`/staff/${id}/reset-password`, {});
  return data ?? {};
}

/** Vardiya hatırlatma kontrolü — sunucu gerekirse hatırlatma bildirimi üretir (web paritesi). */
export async function checkStaffShiftReminder(): Promise<unknown> {
  const { data } = await apiClient.post('/sessions/attendance/shift-reminder', {});
  return data;
}
