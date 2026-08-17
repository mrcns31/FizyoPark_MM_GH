import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmAttendance,
  createSession,
  deleteSession,
  getSessions,
  moveSessionToPackage,
  swapSessions,
  updateSession,
  type AttendanceAction,
  type SessionInput,
  type SessionQuery,
} from './sessions';

export const sessionKeys = {
  all: ['sessions'] as const,
  list: (q: SessionQuery) => ['sessions', q] as const,
};

export function useSessions(q: SessionQuery = {}) {
  return useQuery({
    queryKey: sessionKeys.list(q),
    queryFn: () => getSessions(q),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData, // eski veri yerinde kalsın, ekran titremez
  });
}

/**
 * Seans değişince hem sessions hem member-package-sessions cache'ini temizle.
 *
 * Bilerek Promise DÖNDÜRMEZ. onSuccess'ten promise dönerse react-query mutation'ı
 * o promise bitene kadar "pending" tutar; invalidateQueries ise aktif sorguların
 * yeniden çekilmesini bekler. Sonuç: kayıt sunucuda bitmiş olsa bile ekran, açık
 * olan tüm seans sorguları yeniden inene kadar bekliyordu (üye başına bir tur).
 * Tazeleme arka planda olsun; kaydetme onu beklemesin.
 */
function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: sessionKeys.all });
  void qc.invalidateQueries({ queryKey: ['member-package-sessions'] });
}

export function useConfirmAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sessionId: number; action: AttendanceAction }) =>
      confirmAttendance(vars.sessionId, vars.action),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionInput) => createSession(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: SessionInput; adminPassword?: string }) =>
      updateSession(vars.id, vars.data, vars.adminPassword),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; adminPassword?: string }) =>
      deleteSession(vars.id, vars.adminPassword),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSwapSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sessionAId: number; sessionBId: number; adminPassword?: string }) =>
      swapSessions(vars.sessionAId, vars.sessionBId, vars.adminPassword),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMoveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; targetMpId: number; adminPassword?: string }) =>
      moveSessionToPackage(vars.id, vars.targetMpId, vars.adminPassword),
    onSuccess: () => invalidateAll(qc),
  });
}
