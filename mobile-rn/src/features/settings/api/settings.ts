import { apiClient } from '../../../lib/api-client';

/** Çalışma saatleri (admin) — /settings/working-hours. day_of_week (0=Pazar) -> {enabled,start,end}. */

export interface DayHours {
  enabled: boolean;
  start: string; // "08:00"
  end: string; // "20:00"
}

export type WorkingHours = Record<number, DayHours>;

/** 0=Pazar .. 6=Cumartesi — backend kayıt yoksa varsayılan (kapalı, 08:00–20:00). */
export function defaultDayHours(): DayHours {
  return { enabled: false, start: '08:00', end: '20:00' };
}

export async function getWorkingHours(): Promise<WorkingHours> {
  const { data } = await apiClient.get('/settings/working-hours');
  // backend { workingHours: {0:{...}} } veya direkt {0:{...}} olabilir
  const wh = (data?.workingHours ?? data ?? {}) as Record<string, any>;
  const out: WorkingHours = {};
  // 7 günün tamamı dolu gelsin (backend eksik gün döndürse de editör tam liste gösterir)
  for (let day = 0; day < 7; day++) out[day] = defaultDayHours();
  for (const [k, v] of Object.entries(wh)) {
    const day = Number(k);
    if (Number.isNaN(day) || day < 0 || day > 6) continue;
    out[day] = {
      enabled: !!v.enabled,
      start: v.start || v.start_time || '08:00',
      end: v.end || v.end_time || '20:00',
    };
  }
  return out;
}

/** Çalışma saatlerini kaydet — PUT /settings/working-hours, payload { "0": {enabled,start,end}, ... }. */
export async function updateWorkingHours(hours: WorkingHours): Promise<void> {
  const payload: Record<string, DayHours> = {};
  for (const [k, v] of Object.entries(hours)) payload[k] = v;
  await apiClient.put('/settings/working-hours', payload);
}

/** Kurum WhatsApp numarası — GET /settings/institution-whatsapp. */
export async function getInstitutionWhatsApp(): Promise<string> {
  const { data } = await apiClient.get('/settings/institution-whatsapp');
  return data?.whatsapp || '';
}
