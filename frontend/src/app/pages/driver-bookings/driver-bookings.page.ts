import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { IonBadge, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { WorkspaceHeaderComponent } from '../workspace-header.component';
import { RouteCoordinate } from '../../shared/route-map.component';
import { RouteMapModalComponent } from '../../shared/route-map-modal.component';

type BookingStatus = 'pending' | 'confirmed' | 'started' | 'arrived' | 'completed' | 'cancelled';
type Booking = { id: string; customerName: string; pickup: string; destination: string; notes?: string; time: string; amount: number | null; status: BookingStatus; routeUrl?: string; driverCoordinates?: RouteCoordinate; employerCoordinates?: RouteCoordinate; acceptedAt?: string; startedAt?: string; arrivedAt?: string; completedAt?: string; createdAt?: string; updatedAt?: string };

@Component({
  standalone: true,
  imports: [CommonModule, IonBadge, IonButton, IonContent, IonFooter, IonIcon, IonRefresher, IonRefresherContent, WorkspaceHeaderComponent, RouteMapModalComponent],
  templateUrl: './driver-bookings.page.html',
  styleUrl: './driver-bookings.page.scss'
})
export class DriverBookingsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  readonly auth = inject(AuthService);
  bookings: Booking[] = [];
  selectedRouteBooking: Booking | null = null;
  routeModalOpen = false;
  loading = true;
  error = '';
  private refreshId?: number;

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 12000);
  }
  ngOnDestroy() { if (this.refreshId) window.clearInterval(this.refreshId); }
  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }
  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) { void this.router.navigateByUrl('/login'); return; }
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      const result = await this.api.get<{ bookings?: Booking[] }>('/drivers/me/bookings', token);
      this.bookings = Array.isArray(result.bookings) ? result.bookings : [];
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load bookings';
    } finally {
      this.loading = false;
    }
  }
  count(status: BookingStatus) { return this.bookings.filter((booking) => booking.status === status).length; }
  relativeBookingTime(booking: Booking) { return relativeTime(this.bookingActivityDate(booking)); }
  async acceptBooking(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'accept'); }
  async rejectBooking(booking: Booking) { await this.updateBooking(booking, 'reject'); }
  async startTrip(booking: Booking) { await this.captureLocationForBooking(); await this.updateBooking(booking, 'start'); }
  async markArrived(booking: Booking) { await this.updateBooking(booking, 'arrived'); }
  openRoute(booking: Booking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  private async updateBooking(booking: Booking, action: 'accept' | 'reject' | 'start' | 'arrived') {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      await this.api.patch(`/bookings/${booking.id}/${action}`, {}, token);
      await this.load();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Booking update failed';
    }
  }
  private async captureLocationForBooking() {
    const token = this.auth.session()?.token;
    if (!token) return;
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      await this.api.patch('/drivers/me/location', { latitude: position.coords.latitude, longitude: position.coords.longitude }, token);
    } catch { /* Location permission failure does not block accepting the booking. */ }
  }
  navigate(route: string) { void this.router.navigateByUrl(route); }
  logout() { this.auth.logout(); }
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
