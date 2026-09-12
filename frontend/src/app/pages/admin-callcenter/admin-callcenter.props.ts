import { AdminCallLog } from '../admin-types';

export type AdminCallHistoryResponse = { calls: AdminCallLog[] };

export const LIVE_ROUTE_STATUSES = new Set(['started', 'arrived']);

export const CALL_STATUS_LABELS: Record<AdminCallLog['status'], string> = {
  ringing: 'Ringing',
  active: 'Active',
  ended: 'Ended',
  declined: 'Declined',
  missed: 'Missed',
  failed: 'Failed',
};
