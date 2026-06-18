import { Badge } from '../../../components/ui';
import type { MemberSession } from '../api/member-portal';

/** Seans durumuna göre rozet tonu. */
export function sessionTone(status: string): 'green' | 'orange' | 'neutral' | 'red' {
  switch (status) {
    case 'completed':
      return 'green';
    case 'cancelled':
    case 'package_cancelled':
      return 'red';
    case 'locked':
      return 'orange';
    default:
      return 'neutral'; // scheduled
  }
}

export function SessionStatusBadge({ session }: { session: MemberSession }) {
  return <Badge label={session.statusLabel} tone={sessionTone(session.status)} />;
}
