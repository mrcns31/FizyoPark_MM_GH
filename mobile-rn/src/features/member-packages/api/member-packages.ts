import { apiClient } from '../../../lib/api-client';
import { memberPackageFromApi, type MemberPackage, type PackageSlot } from '../../../types/api';

/** Üye paketleri (admin) — /member-packages. Paket atama + haftalık slot planlama. */

/** Form'dan gelen slot — kalıcı id olmadan (yeni slot). */
export type SlotInput = Pick<PackageSlot, 'dayOfWeek' | 'startTime' | 'staffId'>;

export interface MemberPackageInput {
  memberId: number;
  packageId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  skipDayDistribution: boolean;
  slots: SlotInput[];
}

function slotsToApi(slots: SlotInput[]) {
  return slots.map((s) => ({
    day_of_week: s.dayOfWeek,
    start_time: s.startTime,
    staff_id: s.staffId,
  }));
}

export async function getMemberPackages(memberId?: number): Promise<MemberPackage[]> {
  const path = memberId != null ? `/member-packages?memberId=${memberId}` : '/member-packages';
  const { data } = await apiClient.get(path);
  return (Array.isArray(data) ? data : []).map(memberPackageFromApi);
}

export async function createMemberPackage(input: MemberPackageInput): Promise<MemberPackage> {
  const payload = {
    member_id: input.memberId,
    package_id: input.packageId,
    start_date: input.startDate,
    end_date: input.endDate,
    skip_day_distribution: input.skipDayDistribution,
    slots: slotsToApi(input.slots),
  };
  const { data } = await apiClient.post('/member-packages', payload);
  return memberPackageFromApi(data);
}

export async function updateMemberPackage(
  id: number,
  body: Partial<{
    startDate: string;
    endDate: string;
    status: string;
    skipDayDistribution: boolean;
    packageId: number;
    slots: SlotInput[];
    effectiveDate: string;
  }>,
): Promise<MemberPackage> {
  const payload: Record<string, unknown> = {};
  if (body.startDate !== undefined) payload.start_date = body.startDate;
  if (body.endDate !== undefined) payload.end_date = body.endDate;
  if (body.status !== undefined) payload.status = body.status;
  if (body.skipDayDistribution !== undefined) payload.skip_day_distribution = body.skipDayDistribution;
  if (body.packageId !== undefined) payload.package_id = body.packageId;
  if (body.effectiveDate !== undefined) payload.effective_date = body.effectiveDate;
  if (body.slots !== undefined) payload.slots = slotsToApi(body.slots);
  const { data } = await apiClient.put(`/member-packages/${id}`, payload);
  return memberPackageFromApi(data);
}

export async function endMemberPackage(id: number, endDate?: string): Promise<void> {
  await apiClient.post(`/member-packages/${id}/end`, endDate ? { end_date: endDate } : {});
}

/** Pakete ait seans (web packageSessionFromApi paritesi). */
export interface MemberPackageSession {
  id: number;
  startTs: number;
  endTs: number;
  note: string;
  staffName: string;
  roomName: string;
  attendanceOutcome: string | null;
  isCancelled: boolean;
  isPast: boolean;
  statusLabel: string | null;
}

export async function getMemberPackageSessions(id: number): Promise<MemberPackageSession[]> {
  const { data } = await apiClient.get(`/member-packages/${id}/sessions`);
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    id: row.id,
    startTs: Number(row.startTs ?? row.start_ts),
    endTs: Number(row.endTs ?? row.end_ts),
    note: row.note || '',
    staffName: row.staffName || row.staff_name || '',
    roomName: row.roomName || row.room_name || '',
    attendanceOutcome: row.attendanceOutcome || row.attendance_outcome || null,
    isCancelled: !!(row.isCancelled ?? row.is_cancelled),
    isPast: !!row.isPast,
    statusLabel: row.statusLabel || row.status_label || null,
  }));
}

/** Paket atama öncesi uygunluk/çakışma kontrolü (web checkMemberPackageAvailability). */
export interface AvailabilityConflict {
  date?: string;
  time?: string;
  staffName?: string;
  reason?: string;
  message?: string;
}
export async function checkMemberPackageAvailability(body: {
  memberId: number;
  packageId: number;
  startDate: string;
  endDate: string;
  skipDayDistribution: boolean;
  slots: SlotInput[];
  excludeMemberPackageId?: number;
}): Promise<{ ok: boolean; conflicts: AvailabilityConflict[] }> {
  const payload: Record<string, unknown> = {
    member_id: body.memberId,
    package_id: body.packageId,
    start_date: body.startDate,
    end_date: body.endDate,
    skip_day_distribution: body.skipDayDistribution,
    slots: slotsToApi(body.slots),
  };
  if (body.excludeMemberPackageId != null) payload.exclude_member_package_id = body.excludeMemberPackageId;
  const { data } = await apiClient.post('/member-packages/check-availability', payload);
  const conflicts = (data?.conflicts ?? data?.unavailable ?? []) as AvailabilityConflict[];
  return { ok: data?.ok ?? conflicts.length === 0, conflicts };
}
