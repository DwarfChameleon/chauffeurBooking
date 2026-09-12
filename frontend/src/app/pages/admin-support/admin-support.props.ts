import { AdminSupportTicket } from '../admin-types';

export type AdminSupportTicketsResponse = { tickets: AdminSupportTicket[] };

export const ADMIN_SUPPORT_ACTIONS = [
  { label: 'Open Callcenter', route: '/admin/callcenter', icon: 'call-outline', note: 'Initiate or monitor live route calls.' },
  { label: 'Email queue', route: '/admin/notifications', icon: 'mail-outline', note: 'Review outbound support notifications.' },
  { label: 'User reports', route: '/admin/verification', icon: 'warning-outline', note: 'Handle safety and account reports.' },
  { label: 'Bookings', route: '/admin/bookings', icon: 'calendar-outline', note: 'Cross-check ticket booking references.' },
];

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  booking_issue: 'Booking',
  payment_issue: 'Payment',
  account_login: 'Account',
  driver_verification: 'Verification',
  safety_concern: 'Safety',
  app_bug: 'App bug',
  other: 'Other',
};
