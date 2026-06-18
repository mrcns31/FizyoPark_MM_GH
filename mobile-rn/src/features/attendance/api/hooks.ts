import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { confirmAttendance, getEntryList, getWalkInList } from './attendance';

export const attendanceKeys = {
  entry: (date: string) => ['attendance', 'entry', date] as const,
  walkIn: (date: string) => ['attendance', 'walk-in', date] as const,
};

export function useEntryList(date: string) {
  return useQuery({ queryKey: attendanceKeys.entry(date), queryFn: () => getEntryList(date) });
}

export function useWalkInList(date: string) {
  return useQuery({ queryKey: attendanceKeys.walkIn(date), queryFn: () => getWalkInList(date) });
}

export function useConfirmAttendance(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; action: 'present' | 'no_show' }) =>
      confirmAttendance(vars.id, vars.action),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.entry(date) }),
  });
}
