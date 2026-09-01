import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminBooking, BookingStatus } from './admin-types';
import { adminPageStyles } from './admin-users.page';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, IonSearchbar, AdminNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Bookings" [showBack]="true" (refreshRequested)="load()"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <p class="eyebrow">Booking operations</p><h1>Booking control</h1>
      <ion-searchbar placeholder="Search employer, driver, route or status" (ionInput)="query = $any($event.target).value || ''"></ion-searchbar>
      <p class="state error" *ngIf="error">{{ error }}</p>
      <section class="list-panel">
        <article class="booking-card" *ngFor="let booking of filteredBookings" (click)="openBooking(booking)" tabindex="0" (keydown.enter)="openBooking(booking)">
          <div class="avatar amber"><ion-icon name="calendar-outline"></ion-icon></div>
          <div class="body">
            <strong><i class="inline-live-dot" *ngIf="booking.isLiveTrip"></i>{{ booking.employerName }} to {{ booking.driverName }}</strong>
            <small>{{ booking.pickupAddress || 'Pickup pending' }} to {{ booking.destinationAddress || 'destination pending' }}</small>
            <span><ion-icon name="time-outline"></ion-icon>{{ relativeBookingTime(booking) }} • {{ booking.serviceType }}</span>
          </div>
          <div class="controls" (click)="$event.stopPropagation()">
            <i class="status-pill" [ngClass]="booking.status">{{ booking.status }}</i>
            <select [value]="booking.status" (change)="setStatus(booking, $any($event.target).value)">
              <option value="requested">Requested</option><option value="assigned">Assigned</option><option value="accepted">Accepted</option><option value="started">Started</option><option value="arrived">Arrived</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rejected">Rejected</option>
            </select>
          </div>
        </article>
        <p class="empty" *ngIf="!loading && !filteredBookings.length">No bookings found.</p>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="bookings"></app-admin-nav>
  <ion-modal [isOpen]="bookingModalOpen" [initialBreakpoint]="0.78" [breakpoints]="[0, 0.5, 0.78, 0.96]" handle="true" handleBehavior="drag" (didDismiss)="closeBooking()">
    <ng-template>
      <div class="booking-sheet" *ngIf="selectedBooking as booking">
        <header>
          <div><p class="eyebrow">Trip details</p><h2><span class="inline-live-dot" *ngIf="booking.isLiveTrip"></span>{{ booking.employerName }} to {{ booking.driverName }}</h2></div>
          <button class="sheet-close" type="button" (click)="closeBooking()"><ion-icon name="close-outline"></ion-icon></button>
        </header>
        <div class="sheet-grid">
          <article><span>Status</span><strong>{{ booking.status }}</strong></article>
          <article><span>Service</span><strong>{{ booking.serviceType }}</strong></article>
          <article><span>Driver</span><strong>{{ booking.driverName }}</strong><small>{{ booking.driverPhone || booking.driverEmail || 'No contact' }}</small></article>
          <article><span>Employer</span><strong>{{ booking.employerName }}</strong><small>{{ booking.employerPhone || booking.employerEmail || 'No contact' }}</small></article>
        </div>
        <div class="route-box"><p><ion-icon name="location-outline"></ion-icon><strong>Pickup</strong><span>{{ booking.pickupAddress || 'Pickup pending' }}</span></p><p><ion-icon name="navigate-outline"></ion-icon><strong>Destination</strong><span>{{ booking.destinationAddress || 'Destination pending' }}</span></p></div>
        <article class="notes-box"><span>Driver note</span><p>{{ booking.notes || 'No note added.' }}</p></article>
        <div class="timeline-row"><span><ion-icon name="checkmark-circle-outline"></ion-icon>Accepted: {{ exactEventTime(booking.acceptedAt, 'Not accepted yet') }}</span><span><ion-icon name="play-circle-outline"></ion-icon>Started: {{ exactEventTime(booking.startedAt, 'Not started yet') }}</span><span><ion-icon name="flag-outline"></ion-icon>Arrived: {{ exactEventTime(booking.arrivedAt, 'Not arrived yet') }}</span></div>
        <button class="route-button secondary" type="button" *ngIf="booking.routeUrl" (click)="openRoute(booking)"><ion-icon name="map-outline"></ion-icon>View route</button>
      </div>
    </ng-template>
  </ion-modal>
  <app-route-map-modal
    [isOpen]="routeModalOpen"
    [driverCoordinates]="selectedRouteBooking?.driverCoordinates"
    [pickupCoordinates]="selectedRouteBooking?.employerCoordinates"
    [status]="selectedRouteBooking?.status || ''"
    [driverLabel]="selectedRouteBooking?.driverName || 'Driver'"
    [pickupLabel]="selectedRouteBooking?.pickupAddress || 'Employer pickup'"
    [routeTitle]="selectedRouteBooking ? selectedRouteBooking.employerName + ' to ' + selectedRouteBooking.driverName : 'Requested route'"
    (close)="closeRouteMap()">
  </app-route-map-modal>
</div>
  `,
  styles: [adminPageStyles() + `
.booking-card { cursor:pointer; }
.inline-live-dot { display:inline-block; width:9px; height:9px; margin-right:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 6px rgba(34,197,94,.16); vertical-align:middle; }
.body span ion-icon { color:#1954d1; font-size:14px; vertical-align:-2px; margin-right:5px; }
.booking-sheet { min-height:100%; padding:20px; color:var(--admin-text,#101828); background:var(--admin-card,#fff); }
.booking-sheet header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
.booking-sheet h2 { margin:4px 0 0; font-size:19px; }
.sheet-close { width:40px; height:40px; border:0; border-radius:50%; display:grid; place-items:center; color:var(--admin-text,#101828); background:rgba(148,163,184,.18); }
.sheet-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.sheet-grid article,.notes-box,.route-box { border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; padding:12px; background:rgba(148,163,184,.08); }
.sheet-grid span,.notes-box span { display:block; color:var(--admin-muted,#667085); font-size:10px; font-weight:900; text-transform:uppercase; }
.sheet-grid strong,.sheet-grid small { display:block; margin-top:4px; overflow-wrap:anywhere; }
.route-box { margin:12px 0; display:grid; gap:10px; }
.route-box p { display:flex; align-items:flex-start; gap:8px; margin:0; }
.route-box ion-icon { color:#1954d1; font-size:20px; }
.route-box strong { min-width:82px; }
.route-box span { color:var(--admin-muted,#667085); overflow-wrap:anywhere; }
.notes-box p { margin:6px 0 0; color:var(--admin-muted,#667085); }
.timeline-row { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; color:var(--admin-muted,#667085); font-size:12px; }
.timeline-row span { display:inline-flex; align-items:center; gap:5px; }
.timeline-row ion-icon { color:#1954d1; font-size:15px; }
.route-button { display:inline-flex; align-items:center; gap:7px; min-height:40px; border:0; border-radius:8px; padding:0 13px; color:#fff; background:#16a34a; font-weight:900; }
.route-button.secondary { color:#1954d1; background:rgba(25,84,209,.1); }
`],
})
export class AdminBookingsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  bookings: AdminBooking[] = [];
  selectedBooking: AdminBooking | null = null;
  selectedRouteBooking: AdminBooking | null = null;
  bookingModalOpen = false;
  routeModalOpen = false;
  query = '';
  loading = false;
  error = '';
  private refreshId?: number;

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
