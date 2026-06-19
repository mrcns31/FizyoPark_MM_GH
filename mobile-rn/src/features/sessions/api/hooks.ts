import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmAttendance,
  createSession,
  deleteSession,
  getSessions,
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
    refetchInterval: 10_000, // takvim 10 sn'de bir yenilenir (kullanıcı isteği)
  });
}

export function useConfirmAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sessionId: number; action: AttendanceAction }) =>
      confirmAttendance(vars.sessionId, vars.action),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionInput) => createSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; data: SessionInput; adminPassword?: string }) =>
      updateSession(vars.id, vars.data, vars.adminPassword),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; adminPassword?: string }) =>
      deleteSession(vars.id, vars.adminPassword),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}
