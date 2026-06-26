import { apiClient } from '../../../lib/api-client';

/** Üye portalı API çağrıları + tipleri — backend /member-portal/dashboard şekline birebir. */

export interface MemberDashboardProfile {
  id: number;
  memberNo: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  profession: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  systemicDiseases: string | null;
  clinicalConditions: string | null;
  pastOperations: string | null;
  notes: string | null;
  deletionRequestedAt: string | null;
}

export interface MemberSession {
  id: number;
  staffId: number | null;
  staffName: string;
  roomId: number | null;
  roomName: string;
  startTs: number;
  endTs: number;
  note: string;
  checkedIn: boolean;
  isPast: boolean;
  isCancelled: boolean;
  cancelledByMember: boolean;
  isConsumed: boolean;
  canCancel: boolean;
  cancelReason?: string;
  status: string;
  statusLabel: string;
}

export interface MemberPackageDto {
  id: number;
  packageId: number;
  packageName: string;
  packageType: string;
  lessonCount: number;
  startDate: string;
  endDate: string;
  status: string;
  remainingSessions: number;
  usedSessions: number;
  scheduledFuture: number;
  totalSessions: number;
  sessions: MemberSession[];
}

export interface MemberNotification {
  type: string;
  message: string;
  remainingSessions?: number;
}

export interface CatalogPackage {
  id: number;
  name: string;
  lessonCount: number;
  packageType: string;
}

export interface PendingPackageRequest {
  id: number;
  packageId: number;
  packageName: string;
  requestedAt: string | null;
}

export interface MemberDashboard {
  profile: MemberDashboardProfile;
  activePackage: MemberPackageDto | null;
  pastPackages: MemberPackageDto[];
  notifications: MemberNotification[];
  lastCheckIn: { at: number; ok: boolean } | null;
  contactWhatsApp: string | null;
  pendingPackageRequest: PendingPackageRequest | null;
  catalogPackages: CatalogPackage[];
}

export async function getMemberDashboard(): Promise<MemberDashboard> {
  const { data } = await apiClient.get<MemberDashboard>('/member-portal/dashboard');
  return data;
}

export async function cancelMemberSession(
  sessionId: number,
  body?: Record<string, unknown>
): Promise<unknown> {
  const { data } = await apiClient.post(`/member-portal/sessions/${sessionId}/cancel`, body || {});
  return data;
}

export async function requestMemberAccountDeletion(): Promise<unknown> {
  const { data } = await apiClient.post('/member-portal/request-account-deletion', {});
  return data;
}

export async function createMemberPackageRequest(packageId: number): Promise<unknown> {
  const { data } = await apiClient.post('/member-portal/package-request', { package_id: packageId });
  return data;
}

export interface MemberAccessQr {
  qrDataUrl: string;
  expiresIn: number;
  windowSec: number;
  memberId: number;
}

export async function getMemberAccessQr(): Promise<MemberAccessQr> {
  const { data } = await apiClient.get<MemberAccessQr>('/member-portal/access-qr');
  return data;
}
