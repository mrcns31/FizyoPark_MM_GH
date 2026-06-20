import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Package } from '../../../types/api';
import { createPackage, deletePackage, getPackages, updatePackage } from './packages';

export const packageKeys = { all: ['packages'] as const };

export function usePackages() {
  return useQuery({ queryKey: packageKeys.all, queryFn: getPackages, staleTime: 0, gcTime: 0 });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<Package>) => createPackage(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: packageKeys.all }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: Partial<Package> }) => updatePackage(vars.id, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: packageKeys.all }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePackage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: packageKeys.all }),
  });
}
