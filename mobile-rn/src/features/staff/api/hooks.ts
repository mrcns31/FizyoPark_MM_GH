import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { checkStaffShiftReminder, createStaff, deleteStaff, getStaff, resetStaffPassword, updateStaff, type StaffInput } from './staff';

export const staffKeys = { all: ['staff'] as const };

export function useStaff() {
  return useQuery({ queryKey: staffKeys.all, queryFn: getStaff });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInput) => createStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: StaffInput }) => updateStaff(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useResetStaffPassword() {
  return useMutation({ mutationFn: (id: number) => resetStaffPassword(id) });
}

/** Personel oturumunda 60 sn'de bir vardiya hatırlatmasını sunucuya kontrol ettir. */
export function useStaffShiftReminderPoll() {
  return useQuery({
    queryKey: ['staff', 'shift-reminder'],
    queryFn: checkStaffShiftReminder,
    refetchInterval: 60_000,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; adminPassword: string }) => deleteStaff(vars.id, vars.adminPassword),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}
