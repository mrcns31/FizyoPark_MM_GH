import { apiClient } from '../../../lib/api-client';

/** Admin talep/aksiyon API'leri: paket talepleri, üyelik silme talepleri, kapı. */

export interface PackageRequest {
  id: number;
  memberId: number;
  packageId: number;
  memberName: string;
  memberNo: string;
  packageName: string;
  packageType: string;
  requestedAt: string | null;
  status: string;
}

function packageRequestFromApi(row: any): PackageRequest {
  // Backend DTO camelCase döndürüyor; eski snake_case'i de tolere et.
  return {
    id: row.id,
    memberId: row.memberId ?? row.member_id,
    packageId: row.packageId ?? row.package_id,
    memberName: row.memberName || row.member_name || '',
    memberNo: row.memberNo || row.member_no || '',
    packageName: row.packageName || row.package_name || '',
    packageType: row.packageType || row.package_type || 'fixed',
    requestedAt: row.requestedAt || row.requested_at || null,
    status: row.status || 'pending',
  };
}

export async function getPackageRequests(status = 'pending'): Promise<PackageRequest[]> {
  const { data } = await apiClient.get('/package-requests', { params: { status } });
  return (Array.isArray(data) ? data : []).map(packageRequestFromApi);
}

export async function dismissPackageRequest(id: number): Promise<void> {
  await apiClient.post(`/package-requests/${id}/dismiss`, {});
}

export interface DeletionRequest {
  id: number;
  memberNo: string;
  memberName: string;
  phone: string;
  email: string;
  deletionRequestedAt: string | null;
}

function deletionRequestFromApi(row: any): DeletionRequest {
  return {
    id: row.id,
    memberNo: row.member_no || row.memberNo || '',
    memberName: row.member_name || row.memberName || '',
    phone: row.phone || '',
    email: row.email || '',
    deletionRequestedAt: row.deletion_requested_at || row.deletionRequestedAt || null,
  };
}

export async function getDeletionRequests(): Promise<DeletionRequest[]> {
  const { data } = await apiClient.get('/members/deletion-requests');
  return (Array.isArray(data) ? data : []).map(deletionRequestFromApi);
}

export async function approveDeletion(id: number): Promise<void> {
  await apiClient.post(`/members/${id}/approve-deletion-request`, {});
}

export async function rejectDeletion(id: number): Promise<void> {
  await apiClient.post(`/members/${id}/reject-deletion-request`, {});
}

export async function openDoor(): Promise<void> {
  await apiClient.post('/door/open', {});
}

export interface PasswordResetRequest {
  id: number;
  email: string;
  status: string;
  createdAt: string;
}

function passwordResetRequestFromApi(row: any): PasswordResetRequest {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at || row.createdAt || '',
  };
}

export async function getPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  const { data } = await apiClient.get('/auth/password-reset-requests');
  return (Array.isArray(data) ? data : []).map(passwordResetRequestFromApi);
}

export interface ResetPasswordResult {
  loginEmail: string;
  temporaryPassword: string;
  phone: string;
  name: string;
}

export async function handlePasswordResetRequest(id: number): Promise<ResetPasswordResult> {
  const { data } = await apiClient.post(`/auth/password-reset-requests/${id}/reset`, {});
  return {
    loginEmail: data.loginEmail,
    temporaryPassword: data.temporaryPassword,
    phone: data.phone || '',
    name: data.name || '',
  };
}
