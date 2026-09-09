import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { AdminNavComponent } from '../admin-nav.component';
import { AdminBooking, BookingStatus } from '../admin-types';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RouteMapModalComponent } from '../../shared/route-map-modal.component';
import { ADMIN_CALL_OPTIONS, AdminCallTarget } from './admin-bookings.props';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  templateUrl: './admin-bookings.page.html',
  styleUrl: './admin-bookings.page.scss'
})
export class AdminBookingsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  bookings: AdminBooking[] = [];
  selectedBooking: AdminBooking | null = null;
  selectedRouteBooking: AdminBooking | null = null;
  callBooking: AdminBooking | null = null;
  bookingModalOpen = false;
  routeModalOpen = false;
  callModalOpen = false;
  query = '';
  loading = false;
  error = '';
  callBusy = false;
  callMessage = '';
  private refreshId?: number;
  readonly callOptions = ADMIN_CALL_OPTIONS;

  get filteredBookings() {
    const value = this.query.trim().toLowerCase();
    if (!value) return this.bookings;
    return this.bookings.filter((booking) => [booking.employerName, booking.driverName, booking.pickupAddress, booking.destinationAddress, booking.status, booking.serviceType].some((item) => String(item || '').toLowerCase().includes(value)));
  }

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 12000);
  }
  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }
  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      this.bookings = await this.api.get<AdminBooking[]>('/admin/bookings', token);
      if (this.selectedBooking) this.selectedBooking = this.bookings.find((booking) => booking.id === this.selectedBooking?.id) || this.selectedBooking;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load bookings';
    } finally {
      this.loading = false;
    }
  }

  async setStatus(booking: AdminBooking, status: BookingStatus) {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const result = await this.api.patch<{ booking: AdminBooking }>(`/admin/bookings/${booking.id}/status`, { status }, token);
      Object.assign(booking, result.booking);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not update booking status';
    }
  }

  displayDate(value?: string) { return value ? new Date(value).toLocaleString() : 'Date pending'; }
  exactEventTime(value: string | undefined, fallback: string) { return value ? new Date(value).toLocaleString() : fallback; }
  relativeBookingTime(booking: AdminBooking) { return relativeTime(this.bookingActivityDate(booking)); }
  openBooking(booking: AdminBooking) { this.selectedBooking = booking; this.bookingModalOpen = true; }
  closeBooking() { this.bookingModalOpen = false; this.selectedBooking = null; }
  openRoute(booking: AdminBooking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  canCall(booking: AdminBooking) { return booking.status === 'started' || booking.status === 'arrived'; }
  openCallOptions(booking: AdminBooking) {
    this.callBooking = booking;
    this.callMessage = '';
    this.callModalOpen = true;
  }
  closeCallOptions() {
    if (this.callBusy) return;
    this.callModalOpen = false;
    this.callBooking = null;
    this.callMessage = '';
  }
  async startWatchtowerCall(target: AdminCallTarget) {
    if (!this.callBooking || this.callBusy) return;
    this.callBusy = true;
    this.callMessage = '';
    try {
      const response = await this.realtime.initiateBookingCall(this.callBooking.id, target);
      this.callMessage = response.message || 'Ringing selected participant.';
      window.setTimeout(() => this.closeCallOptions(), 900);
    } catch (error) {
      this.callMessage = error instanceof Error ? error.message : 'Could not start live call.';
    } finally {
      this.callBusy = false;
    }
  }
  private bookingActivityDate(booking: AdminBooking) {
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
