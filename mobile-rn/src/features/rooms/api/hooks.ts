import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createRoom, deleteRoom, getRooms, updateRoom } from './rooms';

export const roomKeys = { all: ['rooms'] as const };

export function useRooms() {
  return useQuery({ queryKey: roomKeys.all, queryFn: getRooms });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; devices: number }) => createRoom(vars.name, vars.devices),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; name: string; devices: number }) =>
      updateRoom(vars.id, vars.name, vars.devices),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRoom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKeys.all }),
  });
}
