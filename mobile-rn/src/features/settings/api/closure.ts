import { apiClient } from '../../../lib/api-client';

/** Kapalı günler (admin) — /closure-periods. Bayram/resmi tatil/merkez kapanışları. */

export interface ClosurePeriod {
  id: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  description: string;
}

export interface ClosureSummary {
  dayCount: number;
  extendedPackageCount: number;
  rescheduledCount: number;
  cancelledOnlyCount: number;
}

export async function getClosurePeriods(): Promise<ClosurePeriod[]> {
  const { data } = await apiClient.get('/closure-periods');
  return (data?.closurePeriods ?? []) as ClosurePeriod[];
}

export async function createClosurePeriod(body: {
  startDate: string;
  endDate: string;
  description: string;
}): Promise<{ summary: ClosureSummary }> {
  const { data } = await apiClient.post('/closure-periods', body);
  return data as { summary: ClosureSummary };
}

export async function deleteClosurePeriod(id: number): Promise<void> {
  await apiClient.delete(`/closure-periods/${id}`);
}
