import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelMemberSession,
  createMemberPackageRequest,
  getMemberAccessQr,
  getMemberDashboard,
  getMyBroadcasts,
  markBroadcastSeen,
  requestMemberAccountDeletion,
} from './member-portal';

export const memberPortalKeys = {
  dashboard: ['member-portal', 'dashboard'] as const,
  accessQr: ['member-portal', 'access-qr'] as const,
  myBroadcasts: ['member-portal', 'my-broadcasts'] as const,
};

export function useMemberDashboard() {
  return useQuery({
    queryKey: memberPortalKeys.dashboard,
    queryFn: getMemberDashboard,
    staleTime: 0,          // her zaman eski kabul et — focus'ta anında yenile
    refetchInterval: 10_000, // 10 sn'de bir arka planda kontrol
  });
}

export function useMemberAccessQr() {
  return useQuery({
    queryKey: memberPortalKeys.accessQr,
    queryFn: getMemberAccessQr,
    staleTime: 0,
    refetchInterval: 25_000, // token süreli; periyodik yenile
  });
}

/** QR ekranı açıkken check-in'i hızlı (2 sn) izler (web memberQrCheckInPoll paritesi). */
export function useMemberCheckInPoll(enabled: boolean) {
  return useQuery({
    queryKey: ['member-portal', 'checkin-poll'],
    queryFn: getMemberDashboard,
    enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function useCancelMemberSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sessionId: number; body?: Record<string, unknown> }) =>
      cancelMemberSession(vars.sessionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberPortalKeys.dashboard }),
  });
}

export function useRequestAccountDeletion() {
  return useMutation({ mutationFn: requestMemberAccountDeletion });
}

export function useCreatePackageRequest() {
  return useMutation({
    mutationFn: (packageId: number) => createMemberPackageRequest(packageId),
  });
}

export function useMyBroadcasts() {
  return useQuery({
    queryKey: memberPortalKeys.myBroadcasts,
    queryFn: getMyBroadcasts,
    staleTime: 30_000,
  });
}

export function useMarkBroadcastSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markBroadcastSeen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: memberPortalKeys.myBroadcasts }),
  });
}
