import { useQuery } from '@tanstack/react-query';

import { getMyRatingSummary, getRatingList, getStaffRatingSummary } from './ratings';

export const ratingKeys = {
  staffSummary: (year: number) => ['ratings', 'staff-summary', year] as const,
  list: (staffId: number, year: number, month?: number) =>
    ['ratings', 'list', staffId, year, month ?? 'all'] as const,
  mySummary: ['ratings', 'my-summary'] as const,
};

export function useStaffRatingSummary(year: number, enabled = true) {
  return useQuery({
    queryKey: ratingKeys.staffSummary(year),
    queryFn: () => getStaffRatingSummary(year),
    enabled,
    staleTime: 60_000,
  });
}

export function useRatingList(staffId: number | null, year: number, month?: number) {
  return useQuery({
    queryKey: ratingKeys.list(staffId ?? 0, year, month),
    queryFn: () => getRatingList(staffId as number, year, month),
    enabled: staffId != null,
    staleTime: 60_000,
  });
}

export function useMyRatingSummary(enabled = true) {
  return useQuery({
    queryKey: ratingKeys.mySummary,
    queryFn: getMyRatingSummary,
    enabled,
    staleTime: 60_000,
  });
}
