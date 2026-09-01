import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminNavComponent } from './admin-nav.component';
import { AdminBooking, AdminOverview } from './admin-types';
import { WorkspaceHeaderComponent } from './workspace-header.component';
import { RealtimeService } from '../core/realtime.service';
import { RouteMapModalComponent } from '../shared/route-map-modal.component';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, AdminNavComponent, WorkspaceHeaderComponent, RouteMapModalComponent],
  template: `
<div class="ion-page admin-page">
  <app-workspace-header role="admin" title="Admin" [showMenu]="true" [notificationCount]="notificationCount" (refreshRequested)="load(false)"></app-workspace-header>
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content pullingText="Pull to refresh" refreshingSpinner="crescent"></ion-refresher-content></ion-refresher>
    <main class="admin-shell">
      <section class="admin-hero">
        <p class="eyebrow">BJED Chauffeur control room</p>
        <h1>Operations dashboard</h1>
      </section>

      <p class="state error" *ngIf="error">{{ error }}</p>

      <section class="metric-grid">
        <article class="metric-card blue" (click)="go('/admin/users')"><ion-icon name="people-outline"></ion-icon><span>Users</span><strong>{{ overview?.summary?.users || 0 }}</strong></article>
        <article class="metric-card green" (click)="go('/admin/drivers')"><ion-icon name="car-sport-outline"></ion-icon><span>Available drivers</span><strong>{{ overview?.summary?.availableDrivers || 0 }}</strong></article>
        <article class="metric-card amber" (click)="go('/admin/bookings')"><ion-icon name="calendar-outline"></ion-icon><span>Active bookings</span><strong>{{ overview?.summary?.activeBookings || 0 }}</strong></article>
        <article class="metric-card live" (click)="go('/admin/bookings')"><span class="live-dot"></span><ion-icon name="radio-outline"></ion-icon><span>Live trips</span><strong>{{ overview?.summary?.liveTrips || 0 }}</strong></article>
        <article class="metric-card purple" (click)="go('/admin/verification')"><ion-icon name="shield-checkmark-outline"></ion-icon><span>Pending docs</span><strong>{{ overview?.summary?.pendingDocuments || 0 }}</strong></article>
      </section>

      <section class="admin-panel">
        <div class="panel-title"><div><p class="eyebrow">Live work</p><h2>Recent bookings</h2></div><button type="button" (click)="go('/admin/bookings')">View all</button></div>
        <button class="booking-row" *ngFor="let booking of overview?.recentBookings || []" type="button" (click)="openBooking(booking)">
          <span><strong><i class="inline-live-dot" *ngIf="booking.isLiveTrip"></i>{{ booking.employerName }}</strong><small>{{ booking.pickupAddress || 'Pickup pending' }} to {{ booking.destinationAddress || 'destination pending' }}</small><small class="relative-line"><ion-icon name="time-outline"></ion-icon>{{ relativeBookingTime(booking) }}</small></span>
          <em class="status-badge" [ngClass]="booking.status">{{ booking.status }}</em>
        </button>
        <p class="empty" *ngIf="!loading && !(overview?.recentBookings || []).length">No bookings yet.</p>
      </section>

      <section class="admin-panel">
        <div class="panel-title"><div><p class="eyebrow">Attention</p><h2>Admin alerts</h2></div><button type="button" (click)="go('/admin/notifications')">Open</button></div>
        <article class="notice-card" *ngFor="let notice of overview?.notifications || []"><ion-icon [name]="noticeIcon(notice.type)"></ion-icon><span><strong>{{ notice.title }}</strong><small>{{ notice.body }}</small></span></article>
      </section>
    </main>
  </ion-content>
  <app-admin-nav active="dashboard"></app-admin-nav>
  <ion-modal [isOpen]="bookingModalOpen" [initialBreakpoint]="0.78" [breakpoints]="[0, 0.5, 0.78, 0.96]" handle="true" handleBehavior="drag" (didDismiss)="closeBooking()">
    <ng-template>
      <div class="booking-sheet" *ngIf="selectedBooking as booking">
        <header>
          <div>
            <p class="eyebrow">Trip details</p>
            <h2><span class="inline-live-dot" *ngIf="booking.isLiveTrip"></span>{{ booking.employerName }} to {{ booking.driverName }}</h2>
          </div>
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
    [destinationLabel]="selectedRouteBooking?.destinationAddress || ''"
    [routeTitle]="selectedRouteBooking ? selectedRouteBooking.employerName + ' to ' + selectedRouteBooking.driverName : 'Requested route'"
    (close)="closeRouteMap()">
  </app-route-map-modal>
</div>
  `,
  styles: [`
.admin-page ion-content { --background:var(--admin-bg,#f5f8fc); color:var(--admin-text,#101828); }
.admin-shell { padding:18px 14px 92px; max-width:1040px; margin:0 auto; }
.admin-hero h1 { margin:4px 0 0; font-size:24px; color:var(--admin-text,#101828); }
.eyebrow { margin:0; color:#1954d1; font-size:11px; font-weight:900; text-transform:uppercase; }
.metric-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:18px; }
.metric-card { border:1px solid rgba(15,23,42,.08); border-radius:8px; padding:14px; display:grid; gap:8px; text-align:left; cursor:pointer; color:#0f172a; background:#fff; box-shadow:0 10px 28px rgba(15,23,42,.07); }
.metric-card.live { position:relative; border-color:rgba(22,163,74,.3); background:linear-gradient(180deg,#ecfdf5,#fff 58%); }
.metric-card ion-icon { width:34px; height:34px; padding:8px; border-radius:50%; color:#fff; }
.metric-card span { font-size:12px; font-weight:800; color:#526071; }
.metric-card strong { font-size:25px; }
.metric-card.blue ion-icon { background:#1954d1; }.metric-card.green ion-icon { background:#16a34a; }.metric-card.amber ion-icon { background:#d97706; }.metric-card.purple ion-icon { background:#7c3aed; }.metric-card.live ion-icon { background:#16a34a; }
.live-dot,.inline-live-dot { display:inline-block; border-radius:50%; background:#22c55e; box-shadow:0 0 0 6px rgba(34,197,94,.16); }
.live-dot { position:absolute; top:12px; right:12px; width:10px; height:10px; }
.inline-live-dot { width:9px; height:9px; margin-right:8px; vertical-align:middle; }
.admin-panel { margin-top:16px; padding:14px; border:1px solid var(--admin-line,#dbe5f2); border-radius:8px; background:var(--admin-card,#fff); box-shadow:0 10px 28px rgba(15,23,42,.06); }
.panel-title { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:10px; }
.panel-title h2 { margin:2px 0 0; font-size:17px; color:var(--admin-text,#101828); }
.panel-title button { border:0; border-radius:8px; padding:9px 11px; background:rgba(25,84,209,.1); color:#1954d1; font-weight:900; }
.booking-row { width:100%; display:flex; justify-content:space-between; gap:12px; align-items:center; border:0; border-top:1px solid var(--admin-line,#e5e7eb); background:transparent; padding:12px 0; text-align:left; color:var(--admin-text,#101828); }
.booking-row strong,.booking-row small,.notice-card strong,.notice-card small { display:block; }
.booking-row small,.notice-card small,.empty { color:var(--admin-muted,#667085); font-size:12px; margin-top:3px; }
.relative-line { display:inline-flex !important; align-items:center; gap:5px; }
.relative-line ion-icon { color:#1954d1; font-size:14px; }
.status-badge { border-radius:999px; padding:5px 8px; font-size:10px; font-style:normal; font-weight:900; text-transform:uppercase; color:#334155; background:#e2e8f0; }
.status-badge.requested,.status-badge.assigned,.status-badge.accepted,.status-badge.arrived { color:#92400e; background:#fef3c7; } .status-badge.started { color:#166534; background:#dcfce7; } .status-badge.completed { color:#166534; background:#dcfce7; } .status-badge.cancelled,.status-badge.rejected { color:#991b1b; background:#fee2e2; }
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
.notice-card { display:flex; gap:10px; align-items:flex-start; border-top:1px solid var(--admin-line,#e5e7eb); padding:12px 0; }
.notice-card ion-icon { color:#1954d1; font-size:23px; }
.state { padding:12px; }.error { color:#b91c1c; }
:host-context(body.dark-theme) { --admin-bg:#070b13; --admin-card:#0d1420; --admin-line:rgba(255,255,255,.1); --admin-text:#f8fafc; --admin-muted:#b7c0cf; }
:host-context(body.dark-theme) .metric-card { background:#111927; color:#f8fafc; border-color:rgba(255,255,255,.1); }
:host-context(body.dark-theme) .metric-card span { color:#b7c0cf; }
@media (max-width:760px) { .metric-grid,.sheet-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  `],
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  overview: AdminOverview | null = null;
  loading = false;
  error = '';
  selectedBooking: AdminBooking | null = null;
  selectedRouteBooking: AdminBooking | null = null;
  bookingModalOpen = false;
  routeModalOpen = false;
  private refreshId?: number;

  get notificationCount() { return (this.overview?.summary?.activeBookings || 0) + (this.overview?.summary?.pendingDocuments || 0); }

  async ngOnInit() {
    this.realtime.events$.subscribe((event) => { if (event.kind === 'booking') void this.load(false); });
    await this.load();
    this.refreshId = window.setInterval(() => void this.load(false), 10000);
  }

  ngOnDestroy() {
    if (this.refreshId) window.clearInterval(this.refreshId);
  }

  async load(showLoading = true) {
    const token = this.auth.session()?.token;
    if (!token) return;
    if (showLoading) this.loading = true;
    this.error = '';
    try {
      this.overview = await this.api.get<AdminOverview>('/admin/overview', token);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load admin dashboard';
    } finally {
      this.loading = false;
    }
  }

  async refresh(event: CustomEvent) { try { await this.load(false); } finally { await (event.target as any)?.complete(); } }
  go(path: string) { void this.router.navigateByUrl(path); }
  noticeIcon(type: string) { return type === 'booking' ? 'calendar-outline' : type === 'verification' ? 'shield-checkmark-outline' : 'speedometer-outline'; }
  openBooking(booking: AdminBooking) { this.selectedBooking = booking; this.bookingModalOpen = true; }
  closeBooking() { this.bookingModalOpen = false; this.selectedBooking = null; }
  openRoute(booking: AdminBooking) { this.selectedRouteBooking = booking; this.routeModalOpen = true; }
  closeRouteMap() { this.routeModalOpen = false; this.selectedRouteBooking = null; }
  displayDate(value?: string) { return value ? new Date(value).toLocaleString() : 'Pending'; }
  exactEventTime(value: string | undefined, fallback: string) { return value ? new Date(value).toLocaleString() : fallback; }
  relativeBookingTime(booking: AdminBooking) { return relativeTime(this.bookingActivityDate(booking)); }
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
