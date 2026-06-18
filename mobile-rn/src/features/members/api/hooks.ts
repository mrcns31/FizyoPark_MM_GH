import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Member } from '../../../types/api';
import {
  createMember,
  deleteMember,
  getFormerMembers,
  getMembers,
  reactivateMember,
  updateMember,
} from './members';

export const memberKeys = {
  all: ['members'] as const,
  former: ['members', 'former'] as const,
};

export function useMembers() {
  return useQuery({ queryKey: memberKeys.all, queryFn: getMembers });
}

export function useFormerMembers() {
  return useQuery({ queryKey: memberKeys.former, queryFn: getFormerMembers });
}

export function useReactivateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reactivateMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: memberKeys.former });
      qc.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: Partial<Member>) => createMember(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: Partial<Member> }) => updateMember(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.all }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; adminPassword: string; deleteHistory?: boolean }) =>
      deleteMember(vars.id, vars.adminPassword, vars.deleteHistory),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.all }),
  });
}
