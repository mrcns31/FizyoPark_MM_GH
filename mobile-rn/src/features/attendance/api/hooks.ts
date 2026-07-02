import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { confirmAttendance, getEntryList, getWalkInList } from './attendance';

export const attendanceKeys = {
  entry: (startDate: string, endDate: string) => ['attendance', 'entry', startDate, endDate] as const,
  walkIn: (startDate: string, endDate: string) => ['attendance', 'walk-in', startDate, endDate] as const,
};

export function useEntryList(startDate: string, endDate: string) {
  return useQuery({
    queryKey: attendanceKeys.entry(startDate, endDate),
    queryFn: () => getEntryList(startDate, endDate),
  });
}

export function useWalkInList(startDate: string, endDate: string) {
  return useQuery({
    queryKey: attendanceKeys.walkIn(startDate, endDate),
    queryFn: () => getWalkInList(startDate, endDate),
  });
}

export function useConfirmAttendance(startDate: string, endDate: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; action: 'present' | 'no_show' }) =>
      confirmAttendance(vars.id, vars.action),
    onSuccess: () => qc.invalidateQueries({ queryKey: attendanceKeys.entry(startDate, endDate) }),
  });
}
