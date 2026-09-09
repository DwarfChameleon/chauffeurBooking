import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { EmployerNavComponent } from '../employer-nav.component';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RealtimeService } from '../../core/realtime.service';
import { RouteCoordinate } from '../../shared/route-map.component';
import { RouteMapModalComponent } from '../../shared/route-map-modal.component';

type ChauffeurCard = {
  id: string; name: string; picture: string | null; rating: number | null; route: string; routeState: string;
  distanceLabel: string; experienceLevel: string; readinessScore: number; yearsOfExperience: number; vehicleType: string;
  safetyLevel: string; accidentCount: number; completedTrips: number;
};
type Employer = { name: string; email: string; phone: string; employerProfile: { profilePicture: string; companyName: string; state: string; city: string } };
type Booking = { id: string; driverName: string; driverPicture: string | null; serviceType: string; urgency: string; status: string; pickupAddress: string; destinationAddress?: string; notes?: string; displayDate: string; displayTime: string; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };
type Completeness = { score: number; completed: number; total: number; verified: boolean; checks: { key: string; label: string; complete: boolean }[] };
type DashboardResponse = {
  employer: Employer;
  completeness: Completeness;
  stats: { activeRequests: number; completedTrips: number; cancelledTrips: number; totalBookings: number; availableChauffeurs: number };
  currentBooking: Booking | null;
  bookingHistory: Booking[];
  nearbyChauffeurs: ChauffeurCard[];
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonIcon, IonRefresher, IonRefresherContent, EmployerNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  templateUrl: './employer-dashboard.page.html',
  styleUrl: './employer-dashboard.page.scss'
})
export class EmployerDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);
  employer: Employer | null = null;
  stats = { activeRequests: 0, completedTrips: 0, cancelledTrips: 0, totalBookings: 0, availableChauffeurs: 0 };
  notificationCount = 0;
  completeness: Completeness = { score: 0, completed: 0, total: 8, verified: false, checks: [] };
  currentBooking: Booking | null = null;
  selectedBooking: Booking | null = null;
  selectedRouteBooking: Booking | null = null;
  routeModalOpen = false;
  bookingForm = { pickupAddress: '', destinationAddress: '', notes: '' };
  bookingHistory: Booking[] = [];
  nearbyChauffeurs: ChauffeurCard[] = [];
  loading = true;
  savingBooking = false;
  error = '';
  success = '';
  private refreshId?: number;
  private bookingFormDirty = false;

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 12000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.loading = true;
    try {
      const data = await this.api.get<DashboardResponse>('/employers/me/dashboard', token);
      this.employer = data.employer;
      this.stats = { ...this.stats, ...data.stats };
      this.completeness = data.completeness || this.completeness;
      this.currentBooking = data.currentBooking || null;
      if (this.selectedBooking && this.currentBooking?.id === this.selectedBooking.id) {
        this.selectedBooking = this.currentBooking;
        this.syncBookingForm(this.currentBooking);
      }
      this.bookingHistory = data.bookingHistory || [];
      this.nearbyChauffeurs = data.nearbyChauffeurs || [];
      this.notificationCount = (this.currentBooking ? 1 : 0) + Math.min(this.bookingHistory.length, 3) + 1;
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load employer dashboard';
    } finally {
      this.loading = false;
    }
  }

  serviceLabel(value: string) {
    return value ? value.replace(/_/g, ' ') : 'chauffeur';
  }

  navigate(path: string) { void this.router.navigateByUrl(path); }
  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  openBookingEditor() {
    if (!this.currentBooking) return;
    this.selectedBooking = this.currentBooking;
    this.syncBookingForm(this.currentBooking, true);
  }
  async saveBookingDetails() {
    const token = this.auth.session()?.token;
    if (!token || !this.selectedBooking) return;
    this.savingBooking = true;
    this.error = '';
    this.success = '';
    try {
      const response = await this.api.patch<{ booking: Booking }>(`/bookings/${this.selectedBooking.id}`, {
        pickupLocation: { address: this.bookingForm.pickupAddress },
        destinationLocation: { address: this.bookingForm.destinationAddress },
        notes: this.bookingForm.notes,
      }, token);
      const savedBooking = this.normalizeSavedBooking(response.booking, this.selectedBooking);
      this.currentBooking = savedBooking;
      this.selectedBooking = savedBooking;
      this.syncBookingForm(savedBooking, true);
      this.success = 'Route details saved and sent to the driver.';
      await this.load(false);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save booking route';
    } finally {
      this.savingBooking = false;
    }
  }
  async confirmDestination(booking: Booking) {
    const token = this.auth.session()?.token;
    if (!token) return;
    this.savingBooking = true;
    try {
      await this.api.patch(`/bookings/${booking.id}/confirm-destination`, {}, token);
      await this.load(false);
      this.selectedBooking = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not confirm destination';
    } finally {
      this.savingBooking = false;
    }
  }
  back() { if (globalThis.history.length > 1) this.location.back(); else this.navigate('/employer/dashboard'); }
  logout() { this.auth.logout(); }
  markBookingFormDirty() {
    this.bookingFormDirty = true;
    this.success = '';
  }
  private syncBookingForm(booking: Booking, force = false) {
    if (this.bookingFormDirty && !force) return;
    this.bookingForm = {
      pickupAddress: booking.pickupAddress || '',
      destinationAddress: booking.destinationAddress || '',
      notes: booking.notes || '',
    };
    this.bookingFormDirty = false;
  }
  private normalizeSavedBooking(savedBooking: any, fallback: Booking): Booking {
    return {
      ...fallback,
      id: savedBooking?._id || savedBooking?.id || fallback.id,
      driverName: savedBooking?.driver?.user?.name || savedBooking?.driver?.name || fallback.driverName,
      driverPicture: savedBooking?.driver?.profilePicture || savedBooking?.driverPicture || fallback.driverPicture,
      serviceType: savedBooking?.serviceType || fallback.serviceType,
      urgency: savedBooking?.urgency || fallback.urgency,
      status: savedBooking?.status || fallback.status,
      pickupAddress: savedBooking?.pickupLocation?.address || fallback.pickupAddress,
      destinationAddress: savedBooking?.destinationLocation?.address || fallback.destinationAddress,
      notes: typeof savedBooking?.notes === 'string' ? savedBooking.notes : fallback.notes,
      displayDate: savedBooking?.date ? new Date(savedBooking.date).toLocaleDateString() : fallback.displayDate,
      displayTime: savedBooking?.date ? new Date(savedBooking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fallback.displayTime,
      routeUrl: savedBooking?.routeUrl || fallback.routeUrl,
      driverCoordinates: savedBooking?.driverCoordinates || fallback.driverCoordinates,
      employerCoordinates: savedBooking?.employerCoordinates || fallback.employerCoordinates,
      acceptedAt: savedBooking?.acceptedAt || fallback.acceptedAt,
      startedAt: savedBooking?.startedAt || fallback.startedAt,
      arrivedAt: savedBooking?.arrivedAt || fallback.arrivedAt,
      completedAt: savedBooking?.completedAt || fallback.completedAt,
      createdAt: savedBooking?.createdAt || fallback.createdAt,
      updatedAt: savedBooking?.updatedAt || fallback.updatedAt,
    };
  }
  relativeBookingTime(booking: Booking) {
    return relativeTime(this.bookingActivityDate(booking));
  }
  private bookingActivityDate(booking: Booking) {
    return booking.completedAt || booking.arrivedAt || booking.startedAt || booking.acceptedAt || booking.updatedAt || booking.createdAt;
  }
}

function relativeTime(value?: string) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Just now';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const units: [number, string][] = [[2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'min']];
  for (const [unitSeconds, label] of units) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return `${seconds} sec${seconds === 1 ? '' : 's'} ago`;
}
