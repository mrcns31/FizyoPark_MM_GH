import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMemberPackage,
  endMemberPackage,
  getMemberPackages,
  getMemberPackageSessions,
  updateMemberPackage,
  type MemberPackageInput,
  type SlotInput,
} from './member-packages';

export const memberPackageKeys = {
  all: ['member-packages'] as const,
  byMember: (memberId: number) => ['member-packages', memberId] as const,
};

export function useMemberPackages(memberId?: number) {
  return useQuery({
    queryKey: memberId != null ? memberPackageKeys.byMember(memberId) : memberPackageKeys.all,
    queryFn: () => getMemberPackages(memberId),
    enabled: memberId == null || Number.isFinite(memberId),
  });
}

export function useMemberPackageSessions(id?: number) {
  return useQuery({
    queryKey: ['member-package-sessions', id],
    queryFn: () => getMemberPackageSessions(id as number),
    enabled: id != null && Number.isFinite(id),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: memberPackageKeys.all });
    qc.invalidateQueries({ queryKey: ['members'] });
    qc.invalidateQueries({ queryKey: ['sessions'] });
  };
}

export function useCreateMemberPackage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: MemberPackageInput) => createMemberPackage(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberPackage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      body: Partial<{
        startDate: string;
        endDate: string;
        status: string;
        skipDayDistribution: boolean;
        packageId: number;
        slots: SlotInput[];
        effectiveDate: string;
      }>;
    }) => updateMemberPackage(vars.id, vars.body),
    onSuccess: invalidate,
  });
}

export function useEndMemberPackage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: number; endDate?: string }) => endMemberPackage(vars.id, vars.endDate),
    onSuccess: invalidate,
  });
}
