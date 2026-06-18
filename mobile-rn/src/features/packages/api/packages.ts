import { apiClient } from '../../../lib/api-client';
import { packageFromApi, type Package } from '../../../types/api';

/** Paket katalog yönetimi (admin) — /packages. */

export async function getPackages(): Promise<Package[]> {
  const { data } = await apiClient.get('/packages');
  return (Array.isArray(data) ? data : []).map(packageFromApi);
}

function toApi(p: Partial<Package>): Record<string, unknown> {
  return {
    name: p.name,
    lesson_count: p.lessonCount,
    month_overrun: p.monthOverrun ?? 0,
    weekly_lesson_count: p.weeklyLessonCount ?? 0,
    package_type: p.packageType ?? 'fixed',
  };
}

export async function createPackage(p: Partial<Package>): Promise<Package> {
  const { data } = await apiClient.post('/packages', toApi(p));
  return packageFromApi(data);
}

export async function updatePackage(id: number, p: Partial<Package>): Promise<Package> {
  const { data } = await apiClient.put(`/packages/${id}`, toApi(p));
  return packageFromApi(data);
}

export async function deletePackage(id: number): Promise<void> {
  await apiClient.delete(`/packages/${id}`);
}
