import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getWorkingHours, updateWorkingHours, type WorkingHours } from './settings';
import {
  createClosurePeriod,
  deleteClosurePeriod,
  getClosurePeriods,
} from './closure';

export const settingsKeys = {
  workingHours: ['settings', 'working-hours'] as const,
  closurePeriods: ['settings', 'closure-periods'] as const,
};

export function useWorkingHours() {
  return useQuery({ queryKey: settingsKeys.workingHours, queryFn: getWorkingHours });
}

export function useUpdateWorkingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hours: WorkingHours) => updateWorkingHours(hours),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.workingHours }),
  });
}

export function useClosurePeriods() {
  return useQuery({ queryKey: settingsKeys.closurePeriods, queryFn: getClosurePeriods });
}

export function useCreateClosurePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createClosurePeriod,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.closurePeriods }),
  });
}

export function useDeleteClosurePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteClosurePeriod(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.closurePeriods }),
  });
}
