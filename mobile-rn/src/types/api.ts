/**
 * Backend snake_case satırlarını uygulama camelCase tiplerine çeviren mapper'lar.
 * Web'deki api.js (memberFromApi, sessionFromApi, ...) birebir portu.
 * Her feature kendi domain'ini buradan veya kendi api/ klasöründen kullanır.
 */

export type Role = 'admin' | 'manager' | 'staff' | 'member';

export interface UserProfile {
  id: number;
  username: string | null;
  email: string | null;
  role: Role;
  fullName: string | null;
  mustChangePassword: boolean;
  staffId: number | null;
  memberId: number | null;
  phone: string | null;
  consentRequired?: boolean;
  consentVersion?: string;
}

export interface Member {
  id: number;
  name: string;
  memberNo: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  profession: string;
  address: string;
  contactName: string;
  contactPhone: string;
  systemicDiseases: string;
  clinicalConditions: string;
  pastOperations: string;
  notes: string;
  cardNo: string | null;
  deletionRequestedAt: string | null;
  deletedAt: string | null;
}

export function memberFromApi(row: any): Member {
  const name =
    (row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim()) || '';
  return {
    id: row.id,
    name,
    memberNo: row.member_no || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    email: row.email || '',
    birthDate: row.birth_date || '',
    profession: row.profession || '',
    address: row.address || '',
    contactName: row.contact_name || '',
    contactPhone: row.contact_phone || '',
    systemicDiseases: row.systemic_diseases || '',
    clinicalConditions: row.clinical_conditions || '',
    pastOperations: row.past_operations || '',
    notes: row.notes || '',
    cardNo: row.card_no || null,
    deletionRequestedAt: row.deletion_requested_at || null,
    deletedAt: row.deleted_at || null,
  };
}

export function memberToApi(m: Partial<Member> & Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {
    first_name: m.firstName ?? m.first_name,
    last_name: m.lastName ?? m.last_name,
    phone: m.phone,
    email: m.email || null,
    birth_date: m.birthDate ?? m.birth_date ?? null,
    profession: m.profession || null,
    address: m.address || null,
    contact_name: m.contactName ?? m.contact_name ?? null,
    contact_phone: m.contactPhone ?? m.contact_phone ?? null,
    systemic_diseases: m.systemicDiseases ?? m.systemic_diseases ?? null,
    clinical_conditions: m.clinicalConditions ?? m.clinical_conditions ?? null,
    past_operations: m.pastOperations ?? m.past_operations ?? null,
    notes: m.notes || null,
    card_no: m.cardNo !== undefined ? m.cardNo || null : undefined,
  };
  if (m.memberNo || m.member_no) {
    result.member_no = m.memberNo || m.member_no;
  }
  return result;
}

export interface PackageSlot {
  id: number;
  dayOfWeek: number;
  startTime: string;
  staffId: number | null;
}

export interface Session {
  id: number;
  staffId: number | null;
  memberId: number | null;
  memberName: string;
  roomId: number | null;
  memberPackageId: number | null;
  startTs: number;
  endTs: number;
  note: string;
  checkedInAt: string | null;
  checkInMethod: string | null;
  attendanceOutcome: string | null;
  attendanceConfirmedAt: string | null;
  attendanceConfirmedBy: number | null;
  confirmerStaffName: string;
  confirmerRole: string | null;
}

export function sessionFromApi(row: any): Session {
  const confirmerStaffName = `${row.confirmer_first_name || ''} ${row.confirmer_last_name || ''}`.trim();
  const memberName =
    (row.member_name || '').trim() ||
    `${row.member_first_name || ''} ${row.member_last_name || ''}`.trim();
  return {
    id: row.id,
    staffId: row.staff_id,
    memberId: row.member_id,
    memberName,
    roomId: row.room_id || null,
    memberPackageId: row.member_package_id || null,
    startTs: Number(row.start_ts),
    endTs: Number(row.end_ts),
    note: row.note || '',
    checkedInAt: row.checked_in_at || null,
    checkInMethod: row.check_in_method || null,
    attendanceOutcome: row.attendance_outcome || null,
    attendanceConfirmedAt: row.attendance_confirmed_at || null,
    attendanceConfirmedBy: row.attendance_confirmed_by || null,
    confirmerStaffName,
    confirmerRole: row.confirmer_role || null,
  };
}

export interface MemberPackage {
  id: number;
  memberId: number;
  packageId: number;
  packageName: string;
  lessonCount: number;
  startDate: string;
  endDate: string;
  skipDayDistribution: boolean;
  status: string;
  slots: PackageSlot[];
  sessionConflicts: unknown[];
  sessionsCreated: number | null;
  remainingSessions: number | null;
}

export function memberPackageFromApi(row: any): MemberPackage {
  return {
    id: row.id,
    memberId: row.member_id,
    packageId: row.package_id,
    packageName: row.package_name || '',
    lessonCount: row.lesson_count,
    startDate: row.start_date,
    endDate: row.end_date,
    skipDayDistribution: !!row.skip_day_distribution,
    status: row.status || 'active',
    slots: (row.slots || []).map((s: any) => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      staffId: s.staff_id,
    })),
    sessionConflicts: row.sessionConflicts || [],
    sessionsCreated:
      row.sessions_created != null
        ? Number(row.sessions_created)
        : row.sessionsCreated != null
          ? Number(row.sessionsCreated)
          : null,
    remainingSessions:
      row.remaining_sessions != null
        ? Number(row.remaining_sessions)
        : row.remainingSessions != null
          ? Number(row.remainingSessions)
          : null,
  };
}

export interface Package {
  id: number;
  name: string;
  lessonCount: number;
  monthOverrun: number;
  weeklyLessonCount: number;
  packageType: string;
}

export function packageFromApi(row: any): Package {
  return {
    id: row.id,
    name: row.name || '',
    lessonCount: row.lesson_count,
    monthOverrun: row.month_overrun,
    weeklyLessonCount: row.weekly_lesson_count,
    packageType: row.package_type || 'fixed',
  };
}

export interface Room {
  id: number;
  name: string;
  devices: number;
}

export function roomFromApi(row: any): Room {
  return { id: row.id, name: row.name || '', devices: row.devices || 1 };
}
