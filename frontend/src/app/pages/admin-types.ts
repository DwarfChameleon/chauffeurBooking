export type DocumentStatus = 'missing' | 'pending' | 'verified' | 'rejected';
export type DriverDocumentKey = 'id' | 'driversLicense' | 'proofOfAddress';
export type EmployerDocumentKey = 'id' | 'proofOfAddress';
export type BookingStatus = 'requested' | 'assigned' | 'accepted' | 'started' | 'rejected' | 'arrived' | 'completed' | 'cancelled';
export type RouteCoordinate = { latitude: number; longitude: number };

export interface AdminUser {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role: string;
  adminLevel?: 'standard' | 'super';
  adminStatus?: 'active' | 'deactivated';
  adminVerified?: boolean;
  adminVerifiedAt?: string;
  employerProfile?: {
    accountType?: string;
    companyName?: string;
    state?: string;
    city?: string;
    address?: string;
    documents?: Partial<Record<EmployerDocumentKey, { status: DocumentStatus; reference: string }>>;
  };
  createdAt?: string;
}

export interface AdminDriver {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  experience?: number;
  rating?: number | null;
  currentState?: string;
  isAvailable?: boolean;
  isActiveTrip?: boolean;
  activeBookingId?: string;
  activeTripStartedAt?: string | null;
  location?: string;
  vehicle?: { type?: string; transmission?: string; model?: string; plateNumber?: string };
  routeExperience?: { state: string; routes?: string; years?: number }[];
  documents?: Partial<Record<DriverDocumentKey, { status: DocumentStatus; reference: string }>>;
  profilePicture?: string;
  readinessScore?: number;
  createdAt?: string;
}

export interface AdminBooking {
  id: string;
  employerName: string;
  employerEmail?: string;
  employerPhone?: string;
  driverName: string;
  driverEmail?: string;
  driverPhone?: string;
  serviceType: string;
  urgency: string;
  status: BookingStatus;
  isLiveTrip?: boolean;
  pickupAddress?: string;
  destinationAddress?: string;
  notes?: string;
  routeUrl?: string;
  driverCoordinates?: RouteCoordinate | null;
  employerCoordinates?: RouteCoordinate | null;
  acceptedAt?: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminNotice {
  id: string;
  title: string;
  body: string;
  type: string;
  count?: number;
}

export interface AdminCallParticipant {
  user?: string;
  role: 'user' | 'driver' | 'admin';
  label?: string;
  name?: string;
  email?: string;
  phone?: string;
  acceptedAt?: string;
  declinedAt?: string;
}

export interface AdminCallLog {
  id: string;
  callSessionId: string;
  source: 'booking' | 'support';
  target: 'driver' | 'employer' | 'conference' | 'support';
  bookingId?: string;
  bookingLabel?: string;
  initiatedBy?: string;
  initiatedByRole: 'user' | 'driver' | 'admin';
  initiatedBySnapshot?: { name?: string; email?: string; phone?: string };
  participants: AdminCallParticipant[];
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'failed';
  ringStartedAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminSupportTicket {
  id: string;
  ticketNumber: string;
  userId?: string;
  role: 'user' | 'driver' | 'admin';
  category: string;
  subject: string;
  message: string;
  bookingReference?: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  contactSnapshot?: { name?: string; email?: string; phone?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminOverview {
  summary: {
    users: number;
    employers: number;
    drivers: number;
    admins: number;
    bookings: number;
    activeBookings: number;
    liveTrips?: number;
    completedBookings: number;
    cancelledBookings: number;
    availableDrivers: number;
    pendingDocuments: number;
  };
  recentBookings: AdminBooking[];
  verificationQueue: { drivers: AdminDriver[]; employers: AdminUser[] };
  notifications: AdminNotice[];
}

export const DRIVER_DOCUMENTS: { key: DriverDocumentKey; label: string; icon: string }[] = [
  { key: 'id', label: 'Government ID', icon: 'id-card-outline' },
  { key: 'driversLicense', label: 'Drivers License', icon: 'document-text-outline' },
  { key: 'proofOfAddress', label: 'Proof of Address', icon: 'home-outline' },
];

export const EMPLOYER_DOCUMENTS: { key: EmployerDocumentKey; label: string; icon: string }[] = [
  { key: 'id', label: 'Government ID', icon: 'id-card-outline' },
  { key: 'proofOfAddress', label: 'Proof of Address', icon: 'home-outline' },
];
