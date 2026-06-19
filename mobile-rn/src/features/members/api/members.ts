import { apiClient } from '../../../lib/api-client';
import { memberFromApi, memberToApi, type Member } from '../../../types/api';

/** Üye yönetimi (admin) — /members. */

export async function getMembers(): Promise<Member[]> {
  const { data } = await apiClient.get('/members');
  return (Array.isArray(data) ? data : []).map(memberFromApi);
}

export async function createMember(m: Partial<Member>): Promise<Member> {
  const { data } = await apiClient.post('/members', memberToApi(m));
  return memberFromApi(data);
}

export async function updateMember(id: number, m: Partial<Member>): Promise<Member> {
  const { data } = await apiClient.put(`/members/${id}`, memberToApi(m));
  return memberFromApi(data);
}

export async function deleteMember(
  id: number,
  adminPassword: string,
  deleteHistory = false
): Promise<void> {
  // axios DELETE gövdesi `data` ile gönderilir
  await apiClient.delete(`/members/${id}`, { data: { adminPassword, deleteHistory } });
}

/** Eski (iptal/silinmiş) üye — Member + paket/seans sayısı. */
export interface FormerMember extends Member {
  packageCount: number | null;
  sessionCount: number | null;
}

export async function getFormerMembers(): Promise<FormerMember[]> {
  const { data } = await apiClient.get('/members/former');
  return (Array.isArray(data) ? data : []).map((row: any) => ({
    ...memberFromApi(row),
    packageCount: row.package_count ?? row.packageCount ?? null,
    sessionCount: row.session_count ?? row.sessionCount ?? null,
  }));
}

/** Eski üyeyi yeniden aktif et — PUT /members/:id/reactivate. */
export async function reactivateMember(id: number): Promise<Member> {
  const { data } = await apiClient.put(`/members/${id}/reactivate`, {});
  return memberFromApi(data);
}
