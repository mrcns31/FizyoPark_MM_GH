import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listBroadcasts, listBroadcastRecipients, sendBroadcast } from './broadcasts';

export const broadcastKeys = {
  list: (page: number) => ['broadcasts', page] as const,
  recipients: (id: number) => ['broadcasts', 'recipients', id] as const,
};

export function useBroadcasts(page = 1) {
  return useQuery({
    queryKey: broadcastKeys.list(page),
    queryFn: () => listBroadcasts(page),
    staleTime: 30_000,
  });
}

export function useBroadcastRecipients(broadcastId: number | null) {
  return useQuery({
    queryKey: broadcastKeys.recipients(broadcastId ?? 0),
    queryFn: () => listBroadcastRecipients(broadcastId!),
    enabled: broadcastId != null,
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendBroadcast,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['broadcasts'] }),
  });
}
