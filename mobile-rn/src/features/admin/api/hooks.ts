import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveDeletion,
  dismissPackageRequest,
  getDeletionRequests,
  getPackageRequests,
  getPasswordResetRequests,
  handlePasswordResetRequest,
  openDoor,
  rejectDeletion,
} from './requests';

export const adminKeys = {
  packageRequests: ['admin', 'package-requests'] as const,
  deletionRequests: ['admin', 'deletion-requests'] as const,
  passwordResetRequests: ['admin', 'password-reset-requests'] as const,
};

export function usePackageRequests() {
  return useQuery({
    queryKey: adminKeys.packageRequests,
    queryFn: () => getPackageRequests('pending'),
    refetchInterval: 10_000, // talepler 10 sn'de bir yenilenir (kullanıcı isteği)
  });
}

export function useDeletionRequests() {
  return useQuery({
    queryKey: adminKeys.deletionRequests,
    queryFn: getDeletionRequests,
    refetchInterval: 10_000,
  });
}

export function useDismissPackageRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dismissPackageRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.packageRequests }),
  });
}

export function useApproveDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approveDeletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.deletionRequests }),
  });
}

export function useRejectDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rejectDeletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.deletionRequests }),
  });
}

export function useOpenDoor() {
  return useMutation({ mutationFn: openDoor });
}

export function usePasswordResetRequests() {
  return useQuery({
    queryKey: adminKeys.passwordResetRequests,
    queryFn: getPasswordResetRequests,
    refetchInterval: 15_000,
  });
}

export function useHandlePasswordResetRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => handlePasswordResetRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.passwordResetRequests }),
  });
}
