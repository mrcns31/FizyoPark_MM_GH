import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getActivityLogs, type ActivityLogFilter } from './activity-logs';

export function useActivityLogs(page: number, filter: ActivityLogFilter = {}, limit = 30) {
  return useQuery({
    queryKey: ['activity-logs', page, limit, filter],
    queryFn: () => getActivityLogs(page, limit, filter),
    placeholderData: keepPreviousData,
  });
}
